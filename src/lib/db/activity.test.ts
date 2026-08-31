import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  selectResult: { data: [], error: null } as any,
  deleteResult: { count: 5, error: null } as any,
  upsertResult: { error: null } as any,
  deleteOps: [] as string[],
  selectOps: [] as string[],
  upsertPayloads: [] as any[],
  updatePayloads: [] as any[],
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    function chain(table: string) {
      const ops: string[] = [];
      const c: any = {};
      for (const name of ['select', 'eq', 'lt', 'order', 'range', 'limit', 'maybeSingle']) {
        c[name] = (...args: any[]) => {
          ops.push(`${name}:${JSON.stringify(args)}`);
          return c;
        };
      }
      c.delete = (opts?: any) => {
        ops.push(`delete:${JSON.stringify(opts)}`);
        return c;
      };
      c.upsert = (payload: any) => {
        h.upsertPayloads.push({ table, payload });
        return Promise.resolve(h.upsertResult);
      };
      c.update = (payload: any) => {
        h.updatePayloads.push({ table, payload });
        return c;
      };
      c.then = (onFulfilled: any, onRejected: any) => {
        const fullOp = `${table} -> ${ops.join('; ')}`;
        h.selectOps.push(fullOp);
        if (ops.some((o) => o.startsWith('delete:'))) {
          h.deleteOps.push(fullOp);
          return Promise.resolve(h.deleteResult).then(onFulfilled, onRejected);
        }
        return Promise.resolve(h.selectResult).then(onFulfilled, onRejected);
      };
      return c;
    }
    return {
      from: (table: string) => chain(table),
    };
  },
}));

import {
  getActivityLogs,
  deleteLogsByAge,
  deleteLogsOlderThanDays,
  saveLogSettings,
  runAutoCleanupIfEnabled,
  wasCleanupRunThisWeek,
  recordCleanupRun,
  getLastCleanupTime,
  getStartOfCurrentWeek,
} from './activity';

beforeEach(() => {
  h.selectResult = { data: [], error: null };
  h.deleteResult = { count: 5, error: null };
  h.upsertResult = { error: null };
  h.deleteOps = [];
  h.selectOps = [];
  h.upsertPayloads = [];
  h.updatePayloads = [];
  localStorage.clear();
});

describe('getActivityLogs pagination and scoping', () => {
  it('queries activity_logs with range pagination and descending created_at order', async () => {
    h.selectResult = {
      data: [
        {
          id: 'log-1',
          university_id: 'uni-1',
          department_id: 'dept-1',
          action_type: 'students_uploaded',
          performed_by_role: 'admin',
          performed_by_name: 'Admin User',
          performed_by_id: 'u-1',
          target_name: '50 Students',
          section_name: 'Sec A',
          branch_name: 'CSE',
          department_name: 'Computer Science',
          departments: { name: 'Computer Science Joined' },
          details: { count: 50 },
          created_at: '2026-08-31T12:00:00.000Z',
        },
      ],
      error: null,
    };

    const result = await getActivityLogs('uni-1', {
      departmentId: 'dept-1',
      limit: 25,
      offset: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0].departmentName).toBe('Computer Science Joined');
    expect(result[0].actionType).toBe('students_uploaded');

    const op = h.selectOps[0];
    expect(op).toContain('activity_logs');
    expect(op).toContain('range:[50,74]');
    expect(op).toContain('eq:["department_id","dept-1"]');
    expect(op).toContain('eq:["university_id","uni-1"]');
    expect(op).toContain('order:["created_at",{"ascending":false}]');
  });

  it('falls back to stored department_name if department joined relation is null', async () => {
    h.selectResult = {
      data: [
        {
          id: 'log-2',
          university_id: 'uni-1',
          action_type: 'attendance_marked',
          performed_by_role: 'regular_teacher',
          performed_by_name: 'Teacher 1',
          performed_by_id: 'u-2',
          department_name: 'Deleted Dept',
          departments: null,
          created_at: '2026-08-31T12:00:00.000Z',
        },
      ],
      error: null,
    };

    const result = await getActivityLogs('uni-1');
    expect(result[0].departmentName).toBe('Deleted Dept');
  });
});

describe('deleteLogsByAge & deleteLogsOlderThanDays', () => {
  it('deleteLogsByAge uses count exact in delete query and returns deleted count', async () => {
    h.deleteResult = { count: 12, error: null };

    const result = await deleteLogsByAge('uni-1', '30days');

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(12);

    expect(h.deleteOps).toHaveLength(1);
    expect(h.deleteOps[0]).toContain('delete:{"count":"exact"}');
    expect(h.deleteOps[0]).toContain('eq:["university_id","uni-1"]');
    expect(h.deleteOps[0]).toContain('lt:["created_at"');
  });

  it('deleteLogsByAge for "all" deletes without created_at cutoff', async () => {
    h.deleteResult = { count: 42, error: null };

    const result = await deleteLogsByAge('uni-1', 'all');

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(42);
    expect(h.deleteOps[0]).not.toContain('lt:');
  });

  it('deleteLogsOlderThanDays validates days parameter', async () => {
    const invalidRes = await deleteLogsOlderThanDays('uni-1', -1);
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('Invalid retention days');
    expect(h.deleteOps).toHaveLength(0);

    const nanRes = await deleteLogsOlderThanDays('uni-1', NaN);
    expect(nanRes.success).toBe(false);
    expect(h.deleteOps).toHaveLength(0);
  });

  it('deleteLogsOlderThanDays executes delete with count: exact', async () => {
    h.deleteResult = { count: 7, error: null };

    const res = await deleteLogsOlderThanDays('uni-1', 14);
    expect(res.success).toBe(true);
    expect(res.deletedCount).toBe(7);
    expect(h.deleteOps[0]).toContain('delete:{"count":"exact"}');
    expect(h.deleteOps[0]).toContain('lt:["created_at"');
  });
});

describe('saveLogSettings & runAutoCleanupIfEnabled', () => {
  it('validates retentionDays when auto-delete is enabled', async () => {
    const res = await saveLogSettings({
      universityId: 'uni-1',
      autoDeleteEnabled: true,
      retentionDays: -5,
      updatedBy: 'u-1',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Retention days must be a positive number');
    expect(h.upsertPayloads).toHaveLength(0);
  });

  it('saves valid log settings with sanitized integer retention_days', async () => {
    const res = await saveLogSettings({
      universityId: 'uni-1',
      autoDeleteEnabled: true,
      retentionDays: 30.7,
      updatedBy: 'u-1',
    });

    expect(res.success).toBe(true);
    expect(h.upsertPayloads).toHaveLength(1);
    expect(h.upsertPayloads[0].payload.retention_days).toBe(30);
    expect(h.upsertPayloads[0].payload.auto_delete_enabled).toBe(true);
  });

  it('saves null retention_days when autoDeleteEnabled is false', async () => {
    const res = await saveLogSettings({
      universityId: 'uni-1',
      autoDeleteEnabled: false,
      retentionDays: 30,
      updatedBy: 'u-1',
    });

    expect(res.success).toBe(true);
    expect(h.upsertPayloads[0].payload.retention_days).toBeNull();
    expect(h.upsertPayloads[0].payload.auto_delete_enabled).toBe(false);
  });

  it('runAutoCleanupIfEnabled executes cleanup and updates timestamp when due', async () => {
    h.selectResult = {
      data: {
        id: 'set-1',
        university_id: 'uni-1',
        auto_delete_enabled: true,
        retention_days: 60,
        last_auto_cleanup_at: '2026-08-01T00:00:00.000Z',
      },
      error: null,
    };
    h.deleteResult = { count: 3, error: null };

    const res = await runAutoCleanupIfEnabled('uni-1');
    expect(res?.success).toBe(true);
    expect(res?.deletedCount).toBe(3);
    expect(h.updatePayloads).toHaveLength(1);
    expect(h.updatePayloads[0].payload.last_auto_cleanup_at).toBeDefined();
  });

  it('runAutoCleanupIfEnabled skips if cleanup already ran today', async () => {
    h.selectResult = {
      data: {
        id: 'set-1',
        university_id: 'uni-1',
        auto_delete_enabled: true,
        retention_days: 60,
        last_auto_cleanup_at: new Date().toISOString(),
      },
      error: null,
    };

    const res = await runAutoCleanupIfEnabled('uni-1');
    expect(res).toBeNull();
    expect(h.deleteOps).toHaveLength(0);
  });
});

describe('localStorage cleanup tracking helpers', () => {
  it('tracks cleanup runs safely in localStorage', () => {
    expect(wasCleanupRunThisWeek('uni-1')).toBe(false);
    expect(getLastCleanupTime('uni-1')).toBeNull();

    recordCleanupRun('uni-1');
    expect(wasCleanupRunThisWeek('uni-1')).toBe(true);
    expect(getLastCleanupTime('uni-1')).toBeInstanceOf(Date);
  });

  it('computes start of current week starting on Monday', () => {
    const startOfWeek = getStartOfCurrentWeek();
    expect(startOfWeek.getUTCDay()).toBe(1); // Monday
    expect(startOfWeek.getUTCHours()).toBe(0);
    expect(startOfWeek.getUTCMinutes()).toBe(0);
  });
});
