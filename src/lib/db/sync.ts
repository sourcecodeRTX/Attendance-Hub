import { db } from './index';
import { Table } from 'dexie';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceSession, AttendanceMarker } from '@/lib/types';
import type { SyncQueueItem } from '@/lib/types/sync';
import { useUIStore } from '@/lib/stores/ui-store';

let syncInterval: ReturnType<typeof setInterval> | null = null;

const MAX_RETRIES = 5;
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
const PULL_PAGE_SIZE = 500;
const MAX_PULL_PAGES = 2000;
const BULK_UPLOAD_CHUNK_SIZE = 200;
const IN_FILTER_CHUNK_SIZE = 100;

export function startSyncLoop(): void {
  if (syncInterval) return;
  syncInterval = setInterval(processSyncQueue, 15000);
  processSyncQueue();
}

export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function backoffDelayMs(retryCount: number): number {
  return Math.min(30_000 * Math.pow(2, Math.max(0, retryCount - 1)), 10 * 60_000);
}

function isDeadLetter(item: SyncQueueItem): boolean {
  return (item.retryCount || 0) >= MAX_RETRIES;
}

async function refreshSyncStatus(hadFailureThisPass: boolean): Promise<void> {
  const items = await db.syncQueue.toArray();
  if (hadFailureThisPass || items.some(isDeadLetter)) {
    useUIStore.getState().setSyncStatus('failed');
    return;
  }
  const remaining = items.filter((i) => !isDeadLetter(i));
  if (remaining.length > 0) {
    useUIStore.getState().setSyncStatus('pending');
  } else {
    useUIStore.getState().setSyncStatus('synced');
  }
}

async function claimProcessableItems(nowMs: number): Promise<number[]> {
  const nowIso = new Date(nowMs).toISOString();
  const claimedIds: number[] = [];
  await db.transaction('rw', db.syncQueue, async () => {
    const items = await db.syncQueue.orderBy('createdAt').toArray();
    for (const item of items) {
      if (item.id === undefined || isDeadLetter(item)) continue;

      const nextAttemptAt = item.nextAttemptAt ? Date.parse(item.nextAttemptAt) : NaN;
      if (!Number.isNaN(nextAttemptAt) && nextAttemptAt > nowMs) continue;

      const claimedAtMs = item.claimedAt ? Date.parse(item.claimedAt) : NaN;
      if (!Number.isNaN(claimedAtMs) && nowMs - claimedAtMs < CLAIM_TIMEOUT_MS) continue;

      await db.syncQueue.update(item.id, { claimedAt: nowIso });
      claimedIds.push(item.id);
    }
  });
  return claimedIds;
}

export async function processSyncQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const supabase = createClient();
  const nowMs = Date.now();

  const claimedIds = await claimProcessableItems(nowMs);

  if (claimedIds.length === 0) {
    await refreshSyncStatus(false);
    return;
  }

  const claimed = (await db.syncQueue.bulkGet(claimedIds)).filter(
    (i): i is SyncQueueItem => i !== undefined
  );

  useUIStore.getState().setSyncStatus('pending');
  let hadFailure = false;

  for (const item of claimed) {
    try {
      if (item.collection === 'attendance_sessions' && item.type === 'update') {
        const shouldPush = await shouldPushAttendanceUpdate(item);

        // If server state should win, drop this queue item after local overwrite.
        if (!shouldPush) {
          if (item.id !== undefined) {
            await db.syncQueue.delete(item.id);
          }
          continue;
        }
      }

      switch (item.type) {
        case 'create': {
          const { error } = await supabase.from(item.collection).upsert(item.data as any);
          if (error) throw error;
          break;
        }
        case 'bulk_create': {
          const payload = item.data as unknown[];
          if (!Array.isArray(payload)) {
            throw new Error(`bulk_create payload for ${item.collection} is not an array`);
          }
          // Uploaded straight from the browser session so RLS governs every
          // row write. The previous service-role bulk action required
          // super_admin and therefore never succeeded for teachers (F-009).
          for (let i = 0; i < payload.length; i += BULK_UPLOAD_CHUNK_SIZE) {
            const chunk = payload.slice(i, i + BULK_UPLOAD_CHUNK_SIZE);
            const { error } = await supabase.from(item.collection).upsert(chunk as any);
            if (error) throw error;
          }
          break;
        }
        case 'update': {
          const { error } = await supabase
            .from(item.collection)
            .update(item.data as any)
            .eq('id', item.docId);
          if (error) throw error;
          break;
        }
        case 'delete': {
          const { error } = await supabase
            .from(item.collection)
            .delete()
            .eq('id', item.docId);
          if (error) throw error;
          break;
        }
      }

      // A successful attendance_sessions push moves the remote revision
      // forward; mirror it locally so future conflict checks have an accurate
      // baseline (see shouldPushAttendanceUpdate).
      if (
        item.collection === 'attendance_sessions' &&
        (item.type === 'update' || item.type === 'create')
      ) {
        const localRow = await db.attendanceSessions.get(item.docId);
        if (localRow) {
          await db.attendanceSessions.put({
            ...localRow,
            revision: (localRow.revision ?? 0) + 1,
          });
        }
      }

      if (item.id !== undefined) {
        await db.syncQueue.delete(item.id);
      }
    } catch (error: any) {
      const errorCode = error?.code;
      const errorMsg = error?.message || String(error);

      if (errorCode === '23505') {
        console.error(`[SYNC] Unique constraint violation on ${item.collection}:`, {
          constraint: error?.constraint_name,
          docId: item.docId,
          details: error?.details,
          hint: error?.hint,
          type: item.type,
        });
      } else if (errorCode === 'PGRST116') {
        console.warn(`[SYNC] No data found for ${item.collection}/${item.docId}`, {
          type: item.type,
          message: errorMsg,
        });
      } else if (errorCode === '42P01') {
        console.error(`[SYNC] Table does not exist: ${item.collection}`, {
          docId: item.docId,
          type: item.type,
          message: errorMsg,
        });
      } else {
        console.error(`[SYNC] Failed for ${item.collection}/${item.docId}:`, {
          code: errorCode,
          message: errorMsg,
          type: item.type,
          retryCount: item.retryCount || 0,
          details: error?.details,
          hint: error?.hint,
        });
      }

      hadFailure = true;
      if (item.id !== undefined) {
        const nextRetryCount = (item.retryCount || 0) + 1;
        await db.syncQueue.update(item.id, {
          retryCount: nextRetryCount,
          // Release the lease so the next pass can retry after backoff.
          claimedAt: '',
          nextAttemptAt:
            nextRetryCount < MAX_RETRIES
              ? new Date(Date.now() + backoffDelayMs(nextRetryCount)).toISOString()
              : undefined,
        });
      }
    }
  }

  await refreshSyncStatus(hadFailure);
}

async function shouldPushAttendanceUpdate(item: SyncQueueItem): Promise<boolean> {
  const supabase = createClient();
  const { data: remoteRow, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', item.docId)
    .maybeSingle();

  // If row does not exist remotely, keep queued update. The retry/backoff
  // path will handle transient ordering issues.
  if (error || !remoteRow) return true;

  const payload = (item.data ?? {}) as {
    last_modified_by?: AttendanceMarker;
  };

  const localRole = payload.last_modified_by?.role;
  const remoteLockedByTeacher = Boolean(remoteRow.locked_by_teacher);

  // CR updates must never override teacher-locked remote rows.
  if (localRole === 'cr' && remoteLockedByTeacher) {
    await overwriteLocalAttendanceFromRemote(remoteRow);
    return false;
  }

  // Teacher updates should overwrite unlocked CR rows.
  if (
    (localRole === 'primary_teacher' || localRole === 'regular_teacher') &&
    !remoteLockedByTeacher
  ) {
    return true;
  }

  // Conflict fallback: order concurrent edits by the SERVER-maintained
  // revision counter (migration 022), never by device wall clocks. The Dexie
  // row's revision is the baseline our local edit was made against:
  //   remoteRevision <= baseRevision → nobody else wrote since our baseline →
  //     push (this also fixes the old behavior where clock ties silently
  //     favored the remote copy and discarded local edits).
  //   remoteRevision > baseRevision → someone else changed the row first in
  //     server order → their write wins; the local edit loses even if its
  //     skewed clock claims to be newer.
  const localRow = await db.attendanceSessions.get(item.docId);
  const baseRevision = localRow?.revision ?? 0;
  const remoteRevision =
    typeof remoteRow.revision === 'number' && Number.isFinite(remoteRow.revision)
      ? remoteRow.revision
      : 1;

  if (remoteRevision > baseRevision) {
    await overwriteLocalAttendanceFromRemote(remoteRow);
    return false;
  }

  return true;
}

async function overwriteLocalAttendanceFromRemote(remoteRow: any): Promise<void> {
  const localSession: AttendanceSession = {
    id: remoteRow.id,
    universityId: remoteRow.university_id,
    departmentId: remoteRow.department_id,
    sectionId: remoteRow.section_id,
    subjectId: remoteRow.subject_id,
    date: remoteRow.date,
    periodNumber: remoteRow.period_number,
    periodLabel: remoteRow.period_label,
    records: remoteRow.records,
    lockedByTeacher: remoteRow.locked_by_teacher,
    isArchived: remoteRow.is_archived,
    createdBy: remoteRow.created_by,
    lastModifiedBy: remoteRow.last_modified_by,
    createdAt: remoteRow.created_at,
    revision: typeof remoteRow.revision === 'number' ? remoteRow.revision : 1,
  };

  await db.attendanceSessions.put(localSession);
}

interface PullTableSpec {
  remote: string;
  local: Table<any>;
}

const PULL_TABLES: PullTableSpec[] = [
  { remote: 'departments', local: db.departments },
  { remote: 'branches', local: db.branches },
  { remote: 'specialisations', local: db.specialisations },
  { remote: 'sections', local: db.sections },
  { remote: 'users', local: db.users },
  { remote: 'students', local: db.students },
  { remote: 'subjects', local: db.subjects },
  { remote: 'user_sections', local: db.userSections },
  { remote: 'user_subjects', local: db.userSubjects },
  { remote: 'attendance_sessions', local: db.attendanceSessions },
];

async function collectPendingSyncDocIds(): Promise<Set<string>> {
  const pending = new Set<string>();
  const items = await db.syncQueue.toArray();
  for (const item of items) {
    if (isDeadLetter(item)) continue;
    if (item.type === 'bulk_create' && Array.isArray(item.data)) {
      for (const row of item.data as any[]) {
        if (row && typeof row.id === 'string') pending.add(row.id);
      }
    } else if (typeof item.docId === 'string' && item.docId !== '') {
      pending.add(item.docId);
    }
  }
  return pending;
}

async function fetchAllUniversityRows(
  supabase: SupabaseClient,
  table: string,
  universityId: string
): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('university_id', universityId)
      .range(from, from + PULL_PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < PULL_PAGE_SIZE) return all;
    from += PULL_PAGE_SIZE;
  }
  throw new Error(`pullFromCloud: ${table} did not terminate within ${MAX_PULL_PAGES} pages`);
}

async function fetchSubjectSectionRows(
  supabase: SupabaseClient,
  subjectIds: string[]
): Promise<any[]> {
  const all: any[] = [];
  for (let i = 0; i < subjectIds.length; i += IN_FILTER_CHUNK_SIZE) {
    const chunk = subjectIds.slice(i, i + IN_FILTER_CHUNK_SIZE);
    let from = 0;
    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      const { data, error } = await supabase
        .from('subject_sections')
        .select('*')
        .in('subject_id', chunk)
        .range(from, from + PULL_PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...(data ?? []));
      if ((data?.length ?? 0) < PULL_PAGE_SIZE) break;
      from += PULL_PAGE_SIZE;
    }
  }
  return all;
}

async function reconcileDeletes(
  local: Table<any>,
  universityId: string,
  pulledIds: Set<string>,
  pendingIds: Set<string>
): Promise<void> {
  const staleKeys = await local
    .where('universityId')
    .equals(universityId)
    .filter((row: any) => !pulledIds.has(row.id) && !pendingIds.has(row.id))
    .primaryKeys();
  if (staleKeys.length > 0) {
    await local.bulkDelete(staleKeys);
  }
}

export async function pullFromCloud(universityId: string): Promise<void> {
  if (!navigator.onLine) return;

  const supabase = createClient();
  const pendingIds = await collectPendingSyncDocIds();

  for (const { remote, local } of PULL_TABLES) {
    let rows: any[];
    try {
      rows = await fetchAllUniversityRows(supabase, remote, universityId);
    } catch (error) {
      console.error(`Pull failed for ${remote}:`, error);
      continue;
    }

    const mapped = rows.map((row: any) => mapRemoteToLocal(remote, row));
    if (mapped.length > 0) {
      await local.bulkPut(mapped);
    }
    await reconcileDeletes(
      local,
      universityId,
      new Set(mapped.map((m: any) => m.id)),
      pendingIds
    );
  }

  // subject_sections has no university_id column — scope it through the
  // university's subject ids (chunked to keep request URLs bounded). Only run
  // reconciliation against links whose subject still exists remotely; links
  // of remotely-deleted subjects are removed along with those subjects'
  // stale rows below.
  let subjectIds: string[];
  try {
    const subjectRows = await fetchAllUniversityRows(supabase, 'subjects', universityId);
    subjectIds = subjectRows.map((s: any) => s.id);
  } catch (error) {
    console.error('Pull failed for subjects (needed for subject_sections):', error);
    return;
  }

  try {
    const ssRows = await fetchSubjectSectionRows(supabase, subjectIds);
    const mappedSs = ssRows.map((row: any) => mapRemoteToLocal('subject_sections', row));
    if (mappedSs.length > 0) {
      await db.subjectSections.bulkPut(mappedSs);
    }

    const subjectIdSet = new Set(subjectIds);
    const pulledSsIds = new Set(mappedSs.map((m: any) => m.id));
    const staleLinkKeys = await db.subjectSections
      .filter(
        (ss) =>
          subjectIdSet.has(ss.subjectId) &&
          !pulledSsIds.has(ss.id) &&
          !pendingIds.has(ss.id)
      )
      .primaryKeys();

    // Links whose subject no longer exists remotely (cascade-deleted) also go.
    const orphanedLinkKeys = await db.subjectSections
      .filter((ss) => !subjectIdSet.has(ss.subjectId))
      .primaryKeys();

    const toDelete = [...new Set([...staleLinkKeys, ...orphanedLinkKeys])];
    if (toDelete.length > 0) {
      await db.subjectSections.bulkDelete(toDelete);
    }
  } catch (error) {
    console.error('Pull failed for subject_sections:', error);
  }
}

export function mapRemoteToLocal(table: string, row: any): any {
  const base: any = { id: row.id };

  switch (table) {
    case 'departments':
      return { ...base, universityId: row.university_id, name: row.name, code: row.code, adminId: row.admin_id, isActive: row.is_active, createdAt: row.created_at, createdBy: row.created_by };
    case 'branches':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, name: row.name, code: row.code, isActive: row.is_active, createdAt: row.created_at, createdBy: row.created_by };
    case 'specialisations':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, branchId: row.branch_id, name: row.name, code: row.code, isActive: row.is_active, createdAt: row.created_at, createdBy: row.created_by };
    case 'sections':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, branchId: row.branch_id, specialisationId: row.specialisation_id, name: row.name, primaryTeacherId: row.primary_teacher_id, isActive: row.is_active, isArchived: row.is_archived, createdAt: row.created_at, createdBy: row.created_by };
    case 'users':
      return { ...base, universityId: row.university_id, role: row.role, fullName: row.full_name, staffId: row.staff_id, email: row.email, departmentId: row.department_id, isActive: row.is_active, mustChangePassword: row.must_change_password, createdAt: row.created_at, createdBy: row.created_by };
    case 'students':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, branchId: row.branch_id, specialisationId: row.specialisation_id, sectionId: row.section_id, rollNumber: row.roll_number, fullName: row.full_name, isActive: row.is_active, uploadedAt: row.uploaded_at, uploadedBy: row.uploaded_by };
    case 'subjects':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, name: row.name, code: row.code, createdAt: row.created_at, createdBy: row.created_by };
    case 'subject_sections':
      return { ...base, subjectId: row.subject_id, sectionId: row.section_id, createdAt: row.created_at, createdBy: row.created_by };
    case 'user_sections':
      return { ...base, universityId: row.university_id, userId: row.user_id, sectionId: row.section_id, userRole: row.user_role, assignedAt: row.assigned_at, assignedBy: row.assigned_by };
    case 'user_subjects':
      return { ...base, universityId: row.university_id, userId: row.user_id, subjectId: row.subject_id, sectionId: row.section_id, assignedAt: row.assigned_at, assignedBy: row.assigned_by };
    case 'attendance_sessions':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, sectionId: row.section_id, subjectId: row.subject_id, date: row.date, periodNumber: row.period_number, periodLabel: row.period_label, records: row.records, lockedByTeacher: row.locked_by_teacher, isArchived: row.is_archived, createdBy: row.created_by, lastModifiedBy: row.last_modified_by, createdAt: row.created_at, revision: typeof row.revision === 'number' ? row.revision : 1 };
    default:
      throw new Error(`mapRemoteToLocal: received a row for unmapped table "${table}"`);
  }
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
