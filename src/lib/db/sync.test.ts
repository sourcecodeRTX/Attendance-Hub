import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

interface RemoteTableConfig {
  rows?: Row[];
  selectError?: any;
  upsertError?: any;
  updateError?: any;
}

const remoteTables: Record<string, RemoteTableConfig> = {};
let upsertCalls: { table: string; payload: any[] }[] = [];
let updateCalls: { table: string; payload: any; id: string }[] = [];

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => fakeSupabase),
}));

vi.mock('@/app/(dashboard)/backup/actions', () => ({
  adminBulkUpsert: vi.fn(async () => {
    throw new Error('adminBulkUpsert must never be reached by the sync engine');
  }),
}));

function makeQueryBuilder(table: string) {
  const ctx = {
    table,
    op: 'select' as 'select' | 'upsert' | 'update' | 'delete',
    filters: {} as Record<string, any>,
    ranges: [] as { from: number; to: number }[],
    payload: undefined as any,
    maybeSingle: false,
    result: undefined as { data: any; error: any } | undefined,
  };

  const api: any = {};
  const chain = () => api;
  api.select = chain;
  api.eq = (col: string, val: any) => {
    ctx.filters[col] = val;
    return api;
  };
  api.in = (col: string, vals: any[]) => {
    ctx.filters[col] = vals;
    return api;
  };
  api.range = (from: number, to: number) => {
    ctx.ranges.push({ from, to });
    return api;
  };
  api.upsert = (payload: any) => {
    ctx.op = 'upsert';
    ctx.payload = payload;
    return api;
  };
  api.update = (payload: any) => {
    ctx.op = 'update';
    ctx.payload = payload;
    return api;
  };
  api.delete = () => {
    ctx.op = 'delete';
    return api;
  };
  api.maybeSingle = () => {
    ctx.maybeSingle = true;
    return api;
  };

  const resolve = (): { data: any; error: any } => {
    const cfg = remoteTables[table];
    if (ctx.op === 'upsert') {
      upsertCalls.push({ table, payload: ctx.payload });
      return { data: null, error: cfg?.upsertError ?? null };
    }
    if (ctx.op === 'update') {
      updateCalls.push({ table, payload: ctx.payload, id: ctx.filters.id });
      return { data: null, error: cfg?.updateError ?? null };
    }
    if (ctx.op === 'delete') {
      return { data: null, error: null };
    }

    if (cfg?.selectError) return { data: null, error: cfg.selectError };

    let rows = cfg?.rows ? [...cfg.rows] : [];
    if (ctx.filters.id !== undefined) {
      rows = rows.filter((r) => r.id === ctx.filters.id);
      if (ctx.maybeSingle) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }
    if (Array.isArray(ctx.filters.subject_id)) {
      rows = rows.filter((r) => ctx.filters.subject_id.includes(r.subject_id));
    }
    const range = ctx.ranges[0];
    if (range) {
      rows = rows.slice(range.from, range.to + 1);
    }
    return { data: rows, error: null };
  };

  api.then = (
    onFulfilled?: (value: { data: any; error: any }) => any,
    onRejected?: (reason: unknown) => any
  ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);

  return api;
}

const fakeSupabase = {
  from: (table: string) => makeQueryBuilder(table),
};

import { db } from '@/lib/db/index';
import type { SyncQueueItem } from '@/lib/types/sync';
import type { AttendanceMarker, AttendanceSession } from '@/lib/types';
import { mapRemoteToLocal, processSyncQueue, pullFromCloud } from '@/lib/db/sync';
import { useUIStore } from '@/lib/stores/ui-store';

function makeQueueItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    universityId: 'uni-1',
    ownerId: 'user-1',
    type: 'create',
    collection: 'students',
    docId: 'doc-1',
    data: { id: 'doc-1' },
    createdAt: '2026-08-23T00:00:00.000Z',
    retryCount: 0,
    ...overrides,
  };
}

const crMarker: AttendanceMarker = {
  uid: 'cr-1',
  name: 'CR One',
  role: 'cr',
  markedAt: '2026-08-22T10:00:00.000Z',
};

const teacherMarker: AttendanceMarker = {
  uid: 'teacher-1',
  name: 'Teacher One',
  role: 'primary_teacher',
  markedAt: '2026-08-22T10:00:00.000Z',
};

async function addSessionRow(overrides: Partial<AttendanceSession> = {}): Promise<AttendanceSession> {
  const session: AttendanceSession = {
    id: overrides.id ?? 'sess-1',
    universityId: 'uni-1',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    subjectId: 'subj-1',
    date: '2026-08-22',
    periodNumber: 1,
    periodLabel: null,
    records: [],
    lockedByTeacher: false,
    isArchived: false,
    createdBy: teacherMarker,
    lastModifiedBy: teacherMarker,
    createdAt: '2026-08-22T09:00:00.000Z',
    revision: 2,
    ...overrides,
  };
  await db.attendanceSessions.put(session);
  return session;
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const k of Object.keys(remoteTables)) delete remoteTables[k];
  upsertCalls = [];
  updateCalls = [];
  useUIStore.getState().setSyncStatus('synced');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('F-005 — pullFromCloud pagination', () => {
  it('pages through tables larger than one page and caches every row', async () => {
    remoteTables['students'] = {
      rows: Array.from({ length: 501 }, (_, i) => ({
        id: `stu-${i}`,
        university_id: 'uni-1',
        department_id: 'd',
        section_id: 'sec-1',
        roll_number: String(i),
        full_name: `Student ${i}`,
        is_active: true,
      })),
    };

    await pullFromCloud('uni-1');

    const cached = await db.students.count();
    expect(cached).toBe(501);
  });

  it('deletes locally-cached rows that no longer exist remotely', async () => {
    await db.students.bulkPut([
      {
        id: 'stu-kept',
        universityId: 'uni-1',
        departmentId: 'd',
        branchId: 'b',
        specialisationId: null,
        sectionId: 'sec-1',
        rollNumber: '001',
        fullName: 'Kept',
        isActive: true,
        uploadedAt: '2026-08-01T00:00:00.000Z',
        uploadedBy: 'user-1',
      },
      {
        id: 'stu-deleted-remotely',
        universityId: 'uni-1',
        departmentId: 'd',
        branchId: 'b',
        specialisationId: null,
        sectionId: 'sec-1',
        rollNumber: '002',
        fullName: 'Gone',
        isActive: true,
        uploadedAt: '2026-08-01T00:00:00.000Z',
        uploadedBy: 'user-1',
      },
    ]);
    remoteTables['students'] = {
      rows: [
        {
          id: 'stu-kept',
          university_id: 'uni-1',
          department_id: 'd',
          section_id: 'sec-1',
          roll_number: '001',
          full_name: 'Kept',
          is_active: true,
        },
      ],
    };

    await pullFromCloud('uni-1');

    const ids = (await db.students.toArray()).map((s) => s.id);
    expect(ids).toEqual(['stu-kept']);
  });

  it('never reconciles away rows whose writes are still queued in the sync queue', async () => {
    await db.students.put({
      id: 'stu-pending',
      universityId: 'uni-1',
      departmentId: 'd',
      branchId: 'b',
      specialisationId: null,
      sectionId: 'sec-1',
      rollNumber: '003',
      fullName: 'Pending',
      isActive: true,
      uploadedAt: '2026-08-01T00:00:00.000Z',
      uploadedBy: 'user-1',
    });
    await db.syncQueue.add(makeQueueItem({ docId: 'stu-pending', data: { id: 'stu-pending' } }));
    remoteTables['students'] = { rows: [] };

    await pullFromCloud('uni-1');

    const kept = await db.students.get('stu-pending');
    expect(kept).toBeDefined();
  });

  it('skips reconciliation for a table whose fetch fails (fail-open per table)', async () => {
    await db.students.put({
      id: 'stu-local',
      universityId: 'uni-1',
      departmentId: 'd',
      branchId: 'b',
      specialisationId: null,
      sectionId: 'sec-1',
      rollNumber: '001',
      fullName: 'Local',
      isActive: true,
      uploadedAt: '2026-08-01T00:00:00.000Z',
      uploadedBy: 'user-1',
    });
    remoteTables['students'] = { selectError: { message: 'boom', code: 'XX000' } };

    await pullFromCloud('uni-1');

    expect(await db.students.get('stu-local')).toBeDefined();
  });

  it('clears a locally-populated table when the remote table is empty', async () => {
    await db.departments.put({
      id: 'dept-old',
      universityId: 'uni-1',
      name: 'Old',
      code: 'OLD',
      adminId: 'admin-1',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'u',
    });
    remoteTables['departments'] = { rows: [] };

    await pullFromCloud('uni-1');

    expect(await db.departments.count()).toBe(0);
  });
});

describe('F-027 — strict remote mapping', () => {
  it('throws on an unmapped table instead of passing raw snake_case rows into typed stores', () => {
    expect(() => mapRemoteToLocal('some_future_table', { id: 'x', some_col: 1 })).toThrow(
      /unmapped table/
    );
  });

  it('maps pulled attendance_sessions with the server revision counter', async () => {
    remoteTables['attendance_sessions'] = {
      rows: [
        {
          id: 'sess-r1',
          university_id: 'uni-1',
          department_id: 'd',
          section_id: 'sec-1',
          subject_id: 'subj-1',
          date: '2026-08-22',
          period_number: 1,
          records: [],
          locked_by_teacher: false,
          is_archived: false,
          created_at: '2026-08-22T09:00:00.000Z',
          revision: 7,
        },
      ],
    };

    await pullFromCloud('uni-1');

    const local = await db.attendanceSessions.get('sess-r1');
    expect(local?.revision).toBe(7);
  });
});

describe('F-009 — queue claiming, backoff, dead-lettering', () => {
  it('processes a claimed create once and removes the item on success', async () => {
    await db.syncQueue.add(makeQueueItem());

    await processSyncQueue();

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({ table: 'students' });
    expect(await db.syncQueue.count()).toBe(0);
    expect(useUIStore.getState().syncStatus).toBe('synced');
  });

  it('backs off a failed item and does not re-attempt before nextAttemptAt elapses', async () => {
    remoteTables['students'] = { upsertError: { message: 'network down' } };
    await db.syncQueue.add(makeQueueItem());

    await processSyncQueue();

    expect(upsertCalls).toHaveLength(1);
    const afterFirst = await db.syncQueue.toArray();
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].retryCount).toBe(1);
    expect(afterFirst[0].claimedAt).toBe('');
    expect(afterFirst[0].nextAttemptAt).toBeDefined();
    expect(Date.parse(afterFirst[0].nextAttemptAt!)).toBeGreaterThan(Date.now());
    expect(useUIStore.getState().syncStatus).toBe('failed');

    await processSyncQueue();
    expect(upsertCalls).toHaveLength(1);
  });

  it('retries after the backoff window passes', async () => {
    remoteTables['students'] = { upsertError: { message: 'network down' } };
    await db.syncQueue.add(makeQueueItem());
    await processSyncQueue();

    const [item] = await db.syncQueue.toArray();
    await db.syncQueue.update(item.id!, { nextAttemptAt: new Date(Date.now() - 1000).toISOString() });
    delete remoteTables['students'].upsertError;

    await processSyncQueue();

    expect(upsertCalls).toHaveLength(2);
    expect(await db.syncQueue.count()).toBe(0);
    expect(useUIStore.getState().syncStatus).toBe('synced');
  });

  it('dead-letters items after MAX_RETRIES failures: never retried, never silently deleted, status stays failed', async () => {
    await db.syncQueue.add(makeQueueItem({ retryCount: 5 }));

    await processSyncQueue();

    expect(upsertCalls).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(1);
    expect(useUIStore.getState().syncStatus).toBe('failed');
  });

  it('does not steal items freshly claimed by another tab, but reclaims stale leases', async () => {
    await db.syncQueue.add(
      makeQueueItem({
        claimedAt: new Date().toISOString(),
        docId: 'fresh-claim',
        data: { id: 'fresh-claim' },
      })
    );
    await db.syncQueue.add(
      makeQueueItem({
        claimedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        docId: 'stale-claim',
        data: { id: 'stale-claim' },
      })
    );

    await processSyncQueue();

    const claimedTargets = upsertCalls.map((c) => (c.payload as any).id);
    expect(claimedTargets).toEqual(['stale-claim']);
    const remaining = await db.syncQueue.toArray();
    expect(remaining.map((i) => i.docId)).toEqual(['fresh-claim']);
  });

  it('uploads bulk_create payloads directly from the client session in chunks, never via adminBulkUpsert', async () => {
    const payload = Array.from({ length: 450 }, (_, i) => ({
      id: `bulk-stu-${i}`,
      university_id: 'uni-1',
      department_id: 'd',
      section_id: 'sec-1',
      roll_number: String(i),
      full_name: `S ${i}`,
      is_active: true,
    }));
    await db.syncQueue.add(makeQueueItem({ type: 'bulk_create', docId: 'bulk_1', data: payload }));

    await processSyncQueue();

    expect(upsertCalls.length).toBeGreaterThan(1);
    expect(upsertCalls.reduce((n, c) => n + c.payload.length, 0)).toBe(450);
    expect(upsertCalls.every((c) => c.payload.length <= 200)).toBe(true);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('drops empty bulk_create payloads without issuing any request', async () => {
    await db.syncQueue.add(makeQueueItem({ type: 'bulk_create', docId: 'bulk_empty', data: [] }));

    await processSyncQueue();

    expect(upsertCalls).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(0);
  });
});

describe('F-010 — revision-based attendance conflict resolution', () => {
  it('CR update against a teacher-locked remote row overwrites local from remote and drops the item', async () => {
    await addSessionRow({ id: 'sess-locked', lockedByTeacher: true, revision: 4 });
    remoteTables['attendance_sessions'] = {
      rows: [
        {
          id: 'sess-locked',
          university_id: 'uni-1',
          department_id: 'd',
          section_id: 'sec-1',
          subject_id: 'subj-1',
          date: '2026-08-22',
          period_number: 1,
          records: [{ studentId: 's1', rollNumber: '001', isPresent: false, isDutyLeave: false }],
          locked_by_teacher: true,
          is_archived: false,
          created_at: '2026-08-22T09:00:00.000Z',
          last_modified_by: teacherMarker,
          revision: 4,
        },
      ],
    };
    await db.syncQueue.add(
      makeQueueItem({
        type: 'update',
        collection: 'attendance_sessions',
        docId: 'sess-locked',
        data: { records: [], locked_by_teacher: false, last_modified_by: crMarker },
      })
    );

    await processSyncQueue();

    expect(updateCalls).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(0);
    const local = await db.attendanceSessions.get('sess-locked');
    expect(local?.records).toHaveLength(1);
    expect(local?.revision).toBe(4);
  });

  it('teacher push against an unlocked remote row proceeds', async () => {
    await addSessionRow({ id: 'sess-t', revision: 3 });
    remoteTables['attendance_sessions'] = {
      rows: [
        {
          id: 'sess-t',
          locked_by_teacher: false,
          last_modified_by: crMarker,
          revision: 3,
          created_at: '2026-08-22T09:00:00.000Z',
        },
      ],
    };
    await db.syncQueue.add(
      makeQueueItem({
        type: 'update',
        collection: 'attendance_sessions',
        docId: 'sess-t',
        data: { records: [], locked_by_teacher: false, last_modified_by: teacherMarker },
      })
    );

    await processSyncQueue();

    expect(updateCalls).toHaveLength(1);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('pushes when remote revision equals our baseline (ties no longer favor the remote copy)', async () => {
    await addSessionRow({ id: 'sess-eq', revision: 5 });
    remoteTables['attendance_sessions'] = {
      rows: [
        {
          id: 'sess-eq',
          locked_by_teacher: false,
          last_modified_by: crMarker,
          revision: 5,
          created_at: '2026-08-22T09:00:00.000Z',
        },
      ],
    };
    // CR editing an unlocked row nobody else touched since our pull.
    await db.syncQueue.add(
      makeQueueItem({
        type: 'update',
        collection: 'attendance_sessions',
        docId: 'sess-eq',
        data: { records: [], locked_by_teacher: false, last_modified_by: crMarker },
      })
    );

    await processSyncQueue();

    expect(updateCalls).toHaveLength(1);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('clock-skewed local edit loses when the server revision moved ahead', async () => {
    // Local baseline revision 2, remote has advanced to 3 (another device won).
    // Local marker claims a NEWER wall-clock time than the remote write — the
    // old clock-based LWW pushed this edit and clobbered the remote winner.
    await addSessionRow({
      id: 'sess-skew',
      revision: 2,
      lastModifiedBy: { ...crMarker, markedAt: '2026-08-22T18:00:00.000Z' },
    });
    remoteTables['attendance_sessions'] = {
      rows: [
        {
          id: 'sess-skew',
          university_id: 'uni-1',
          department_id: 'd',
          section_id: 'sec-1',
          subject_id: 'subj-1',
          date: '2026-08-22',
          period_number: 1,
          records: [{ studentId: 's1', rollNumber: '001', isPresent: true, isDutyLeave: false }],
          locked_by_teacher: false,
          is_archived: false,
          created_at: '2026-08-22T09:00:00.000Z',
          last_modified_by: {
            uid: 'other-device',
            name: 'Other',
            role: 'primary_teacher',
            markedAt: '2026-08-22T12:00:00.000Z',
          },
          revision: 3,
        },
      ],
    };
    await db.syncQueue.add(
      makeQueueItem({
        type: 'update',
        collection: 'attendance_sessions',
        docId: 'sess-skew',
        data: {
          records: [],
          locked_by_teacher: false,
          last_modified_by: { ...crMarker, markedAt: '2026-08-22T18:00:00.000Z' },
        },
      })
    );

    await processSyncQueue();

    expect(updateCalls).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(0);
    const local = await db.attendanceSessions.get('sess-skew');
    expect(local?.records).toHaveLength(1);
    expect(local?.lastModifiedBy.uid).toBe('other-device');
    expect(local?.revision).toBe(3);
  });

  it('bumps the local stored revision after a successful attendance push', async () => {
    await addSessionRow({ id: 'sess-push', revision: 6 });
    remoteTables['attendance_sessions'] = { rows: [] }; // no remote row yet → push allowed

    await db.syncQueue.add(
      makeQueueItem({
        type: 'update',
        collection: 'attendance_sessions',
        docId: 'sess-push',
        data: { records: [], locked_by_teacher: true, last_modified_by: teacherMarker },
      })
    );

    await processSyncQueue();

    expect(updateCalls).toHaveLength(1);
    const local = await db.attendanceSessions.get('sess-push');
    expect(local?.revision).toBe(7);
  });
});
