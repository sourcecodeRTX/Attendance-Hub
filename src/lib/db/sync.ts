import { db } from './index';
import { createClient } from '@/lib/supabase/client';
import type { AttendanceSession, AttendanceMarker } from '@/lib/types';
import type { SyncQueueItem } from '@/lib/types/sync';
import { useUIStore } from '@/lib/stores/ui-store';

let syncInterval: ReturnType<typeof setInterval> | null = null;

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

export async function processSyncQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const supabase = createClient();
  const items = await db.syncQueue.orderBy('createdAt').toArray();
  if (items.length === 0) {
    useUIStore.getState().setSyncStatus('synced');
    return;
  }

  useUIStore.getState().setSyncStatus('pending');
  let hadFailure = false;

  for (const item of items) {
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
          const { error } = await supabase.from(item.collection).upsert(payload as any);
          if (error) throw error;
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
      if (item.id !== undefined) {
        await db.syncQueue.delete(item.id);
      }
    } catch (error: any) {
      const errorCode = error?.code;
      const errorMsg = error?.message || String(error);
      
      // Enhanced error logging with categorization
      if (errorCode === '23505') {
        // Unique constraint violation
        console.error(`[SYNC] Unique constraint violation on ${item.collection}:`, {
          constraint: error?.constraint_name,
          docId: item.docId,
          details: error?.details,
          hint: error?.hint,
          type: item.type,
          affectedData: item.data
        });
      } else if (errorCode === 'PGRST116') {
        // No rows returned (PostgREST specific)
        console.warn(`[SYNC] No data found for ${item.collection}/${item.docId}`, {
          type: item.type,
          message: errorMsg
        });
      } else if (errorCode === '42P01') {
        // Table doesn't exist
        console.error(`[SYNC] Table does not exist: ${item.collection}`, {
          docId: item.docId,
          type: item.type,
          message: errorMsg
        });
      } else {
        // Generic error with comprehensive details
        console.error(`[SYNC] Failed for ${item.collection}/${item.docId}:`, {
          code: errorCode,
          message: errorMsg,
          type: item.type,
          retryCount: item.retryCount || 0,
          details: error?.details,
          hint: error?.hint
        });
      }
      
      hadFailure = true;
      if (item.id !== undefined) {
        await db.syncQueue.update(item.id, {
          retryCount: (item.retryCount || 0) + 1,
        });
      }
      if ((item.retryCount || 0) >= 5) {
        console.warn(`[SYNC] Skipping failed sync item after 5 retries: ${item.collection}/${item.docId}`);
      }
    }
  }

  const remaining = await db.syncQueue.count();
  if (hadFailure) {
    useUIStore.getState().setSyncStatus('failed');
  } else if (remaining > 0) {
    useUIStore.getState().setSyncStatus('pending');
  } else {
    useUIStore.getState().setSyncStatus('synced');
  }
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

  const localMarker = payload.last_modified_by;
  const localRole = localMarker?.role;
  const localMarkedAt = Date.parse(localMarker?.markedAt ?? item.createdAt);

  const remoteMarker = remoteRow.last_modified_by as AttendanceMarker | null;
  const remoteMarkedAt = Date.parse(remoteMarker?.markedAt ?? remoteRow.created_at);
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

  // Fallback conflict resolution: most recent marker wins.
  if (!Number.isNaN(localMarkedAt) && !Number.isNaN(remoteMarkedAt)) {
    if (localMarkedAt <= remoteMarkedAt) {
      await overwriteLocalAttendanceFromRemote(remoteRow);
      return false;
    }
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
  };

  await db.attendanceSessions.put(localSession);
}

export async function pullFromCloud(universityId: string): Promise<void> {
  if (!navigator.onLine) return;

  const supabase = createClient();
  const tables = [
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

  for (const { remote, local } of tables) {
    const { data, error } = await supabase
      .from(remote)
      .select('*')
      .eq('university_id', universityId);

    if (error) {
      console.error(`Pull failed for ${remote}:`, error);
      continue;
    }

    if (data && data.length > 0) {
      const mapped = data.map((row: any) => mapRemoteToLocal(remote, row));
      await (local as any).bulkPut(mapped);
    }
  }

  // Handle subject_sections separately - filter by subjects that belong to this university
  const { data: subjectsData } = await supabase
    .from('subjects')
    .select('id')
    .eq('university_id', universityId);

  if (subjectsData && subjectsData.length > 0) {
    const subjectIds = subjectsData.map((s: any) => s.id);
    
    const { data: subjectSectionsData, error: subjectSectionsError } = await supabase
      .from('subject_sections')
      .select('*')
      .in('subject_id', subjectIds);

    if (subjectSectionsError) {
      console.error('Pull failed for subject_sections:', subjectSectionsError);
    } else if (subjectSectionsData && subjectSectionsData.length > 0) {
      const mapped = subjectSectionsData.map((row: any) => mapRemoteToLocal('subject_sections', row));
      await db.subjectSections.bulkPut(mapped);
    }
  }
}

function mapRemoteToLocal(table: string, row: any): any {
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
      return { ...base, universityId: row.university_id, departmentId: row.department_id, sectionId: '', name: row.name, code: row.code, createdAt: row.created_at, createdBy: row.created_by };
    case 'subject_sections':
      return { ...base, subjectId: row.subject_id, sectionId: row.section_id, createdAt: row.created_at, createdBy: row.created_by };
    case 'user_sections':
      return { ...base, universityId: row.university_id, userId: row.user_id, sectionId: row.section_id, userRole: row.user_role, assignedAt: row.assigned_at, assignedBy: row.assigned_by };
    case 'user_subjects':
      return { ...base, universityId: row.university_id, userId: row.user_id, subjectId: row.subject_id, sectionId: row.section_id, assignedAt: row.assigned_at, assignedBy: row.assigned_by };
    case 'attendance_sessions':
      return { ...base, universityId: row.university_id, departmentId: row.department_id, sectionId: row.section_id, subjectId: row.subject_id, date: row.date, periodNumber: row.period_number, periodLabel: row.period_label, records: row.records, lockedByTeacher: row.locked_by_teacher, isArchived: row.is_archived, createdBy: row.created_by, lastModifiedBy: row.last_modified_by, createdAt: row.created_at };
    default:
      return row;
  }
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
