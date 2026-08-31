import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  guardResult: { ok: true, userId: 'caller-1' } as any,
  upserts: [] as Array<{ table: string; payload: any }>,
  deletes: [] as Array<{ table: string; ops: string[] }>,
  deletedAuthIds: [] as string[],
  createdAuthUsers: [] as any[],
  selectResolver: ((_table: string) => ({ data: [], error: null })) as any,
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  requireUniversitySuperAdmin: async () => h.guardResult,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    function chain(table: string) {
      const ops: string[] = [];
      const c: any = {};
      for (const name of ['select', 'eq', 'neq', 'in']) {
        c[name] = (...args: any[]) => {
          ops.push(`${name}:${JSON.stringify(args)}`);
          return c;
        };
      }
      c.delete = () => {
        h.deletes.push({ table, ops });
        return c;
      };
      c.upsert = (payload: any) => {
        h.upserts.push({ table, payload });
        return Promise.resolve({ data: null, error: null });
      };
      c.then = (onFulfilled: any, onRejected: any) =>
        Promise.resolve(h.selectResolver(table, [...ops])).then(onFulfilled, onRejected);
      return c;
    }
    return {
      from: (table: string) => chain(table),
      auth: {
        admin: {
          createUser: async (args: any) => {
            h.createdAuthUsers.push(args);
            return {
              data: { user: { id: `new-auth-${h.createdAuthUsers.length}`, email: args.email } },
              error: null,
            };
          },
          deleteUser: async (id: string) => {
            h.deletedAuthIds.push(id);
            return { data: {}, error: null };
          },
          listUsers: async () => {
            throw new Error('listUsers must never be called (cross-university leak)');
          },
        },
      },
    };
  },
}));

import { wipeUniversityData, adminBulkUpsert, restoreUniversityData } from './actions';

beforeEach(() => {
  h.guardResult = { ok: true, userId: 'caller-1' };
  h.upserts = [];
  h.deletes = [];
  h.deletedAuthIds = [];
  h.createdAuthUsers = [];
  h.selectResolver = () => ({ data: [], error: null });
});

describe('wipeUniversityData authorization (F-001)', () => {
  it('rejects callers who fail server-side verification without touching any table', async () => {
    h.guardResult = { ok: false, error: 'Insufficient permissions.' };

    const res = await wipeUniversityData('uni-1');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Insufficient permissions.');
    expect(h.deletes).toHaveLength(0);
    expect(h.deletedAuthIds).toHaveLength(0);
  });

  it('uses the verified session uid as the protected current user', async () => {
    const universityUsers = [{ id: 'teacher-9' }, { id: 'caller-1' }];
    h.selectResolver = (table: string, ops: string[]) => {
      if (table === 'subjects') return { data: [], error: null };
      if (table === 'users') {
        // Honour the .neq('id', <uid>) filter exactly like Postgres would.
        const excluded = ops
          .filter((op) => op.startsWith('neq:') && op.includes('"id"'))
          .map((op) => JSON.parse(op.slice(4))[1]);
        return { data: universityUsers.filter((u) => !excluded.includes(u.id)), error: null };
      }
      return { data: [], error: null };
    };

    const res = await wipeUniversityData('uni-1');

    expect(res.success).toBe(true);
    expect(h.deletedAuthIds).toEqual(['teacher-9']);
    expect(h.deletedAuthIds).not.toContain('caller-1');

    const usersDelete = h.deletes.find((d) => d.table === 'users');
    expect(usersDelete).toBeDefined();
    expect(usersDelete!.ops.some((op) => op.includes('"caller-1"'))).toBe(true);
  });
});

describe('adminBulkUpsert authorization + collection whitelist (F-002)', () => {
  it('rejects unauthorized callers without writing', async () => {
    h.guardResult = { ok: false, error: 'Authentication required.' };

    const res = await adminBulkUpsert('students', [{ id: 's1' }], 'uni-1');

    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('rejects collections outside the whitelist even for authorized super admins', async () => {
    const res = await adminBulkUpsert('auth_users', [{ id: 'x' }], 'uni-1');

    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('forces university_id onto whitelisted payloads', async () => {
    const res = await adminBulkUpsert('students', [{ id: 's1', full_name: 'A' }], 'uni-1');

    expect(res.success).toBe(true);
    expect(h.upserts[0].table).toBe('students');
    expect(h.upserts[0].payload[0]).toEqual({
      id: 's1',
      full_name: 'A',
      university_id: 'uni-1',
    });
  });

  it('does not force university_id onto subject_sections rows', async () => {
    const res = await adminBulkUpsert(
      'subject_sections',
      [{ subject_id: 'sub1', section_id: 'sec1' }],
      'uni-1'
    );

    expect(res.success).toBe(true);
    expect(h.upserts[0].payload[0]).toEqual({ subject_id: 'sub1', section_id: 'sec1' });
  });

  it('chunks payloads larger than 200 rows into multiple batches', async () => {
    const largePayload = Array.from({ length: 450 }, (_, i) => ({
      id: `s-${i}`,
      full_name: `Student ${i}`,
    }));

    const res = await adminBulkUpsert('students', largePayload, 'uni-1');

    expect(res.success).toBe(true);
    const studentUpserts = h.upserts.filter((u) => u.table === 'students');
    expect(studentUpserts).toHaveLength(3);
    expect(studentUpserts[0].payload).toHaveLength(200);
    expect(studentUpserts[1].payload).toHaveLength(200);
    expect(studentUpserts[2].payload).toHaveLength(50);
  });
});

describe('restoreUniversityData authorization (F-002)', () => {
  it('rejects unauthorized callers without writing anything', async () => {
    h.guardResult = { ok: false, error: 'Insufficient permissions.' };

    const res = await restoreUniversityData(
      'uni-1',
      { users: [], departments: [], branches: [], specialisations: [], sections: [], subjects: [] },
      {}
    );

    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('rejects non-object or null settings/data payloads', async () => {
    const res1 = await restoreUniversityData('uni-1', null, {});
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('settings and data must be objects');

    const res2 = await restoreUniversityData('uni-1', {}, null);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('settings and data must be objects');
  });
});

describe('restore auth-user lifecycle (F-007, F-008)', () => {
  const emptySettings = () => ({
    departments: [],
    branches: [],
    specialisations: [],
    sections: [],
    subjects: [],
  });

  it('creates new accounts with a random one-time password, never Password123!, and forces must_change_password', async () => {
    h.selectResolver = (table: string) => {
      if (table === 'users') return { data: [{ id: 'ex-1', email: 'match@uni.com', staff_id: 'ST-1' }], error: null };
      return { data: [], error: null };
    };

    const settings = {
      ...emptySettings(),
      users: [
        {
          id: 'bu-new',
          role: 'cr',
          email: 'fresh@uni.com',
          fullName: 'Fresh Person',
          staffId: 'CR-FRESH',
          isActive: true,
          mustChangePassword: false,
        },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, {});

    expect(res.success).toBe(true);
    expect(h.createdAuthUsers).toHaveLength(1);
    const created = h.createdAuthUsers[0];
    expect(created.email).toBe('fresh@uni.com');
    expect(created.password).not.toBe('Password123!');
    expect(created.password).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const userUpserts = h.upserts.filter((u) => u.table === 'users');
    const flattened = userUpserts.flatMap((u) => u.payload);
    const freshRow = flattened.find((r: any) => r.email === 'fresh@uni.com');
    expect(freshRow).toBeDefined();
    expect(freshRow.id).toBe('new-auth-1');
    expect(freshRow.must_change_password).toBe(true);

    expect(res.credentials).toEqual([
      { email: 'fresh@uni.com', fullName: 'Fresh Person', temporaryPassword: created.password },
    ]);
  });

  it('matches backup users only against profiles already in this university, never project-wide', async () => {
    h.selectResolver = (table: string) => {
      if (table === 'users') return { data: [{ id: 'ex-1', email: 'match@uni.com', staff_id: 'ST-1' }], error: null };
      return { data: [], error: null };
    };

    const settings = {
      ...emptySettings(),
      users: [
        {
          id: 'bu-1',
          role: 'regular_teacher',
          email: 'Match@Uni.com',
          fullName: 'Case Insensitive Match',
        },
        {
          id: 'bu-2',
          role: 'cr',
          email: 'someone-else-project-wide@uni.com',
          fullName: 'Not In This University',
        },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, {});

    expect(res.success).toBe(true);
    // Only the unmatched user goes through account creation.
    expect(h.createdAuthUsers.map((c) => c.email)).toEqual(['someone-else-project-wide@uni.com']);

    const flattened = h.upserts.filter((u) => u.table === 'users').flatMap((u) => u.payload);
    const remapped = flattened.find((r: any) => r.id === 'ex-1');
    expect(remapped).toBeDefined();
    expect(flattened.find((r: any) => r.id === 'bu-1')).toBeUndefined();
  });

  it('falls back to staff_id matching scoped to this university', async () => {
    h.selectResolver = (table: string) => {
      if (table === 'users') return { data: [{ id: 'ex-staff', email: 'old-email@uni.com', staff_id: 'ST-42' }], error: null };
      return { data: [], error: null };
    };

    const settings = {
      ...emptySettings(),
      users: [
        {
          id: 'bu-staff',
          role: 'regular_teacher',
          email: 'changed-email@uni.com',
          staffId: 'ST-42',
        },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, {});

    expect(res.success).toBe(true);
    expect(h.createdAuthUsers).toHaveLength(0);
    const flattened = h.upserts.filter((u) => u.table === 'users').flatMap((u) => u.payload);
    expect(flattened.some((r: any) => r.id === 'ex-staff')).toBe(true);
  });

  it('never calls the project-wide auth user listing', async () => {
    h.selectResolver = () => ({ data: [], error: null });

    const settings = {
      ...emptySettings(),
      users: [
        { id: 'bu-x', role: 'cr', email: 'x@uni.com', fullName: 'X' },
      ],
    };

    await restoreUniversityData('uni-1', settings, {});
    // listUsers throws if invoked, so reaching here means it was never called.
    expect(h.createdAuthUsers.map((c) => c.email)).toEqual(['x@uni.com']);
  });

  it('remaps backup super_admin ID to the current active super_admin userId across relations', async () => {
    h.selectResolver = () => ({ data: [], error: null });

    const settings = {
      ...emptySettings(),
      users: [
        { id: 'old-sa-id', role: 'super_admin', email: 'admin@uni.com', fullName: 'Old SA' },
        { id: 't-1', role: 'regular_teacher', email: 't1@uni.com', fullName: 'Teacher 1' },
      ],
      departments: [
        { id: 'dept-1', name: 'CS', code: 'CS', createdBy: 'old-sa-id', universityId: 'uni-1' },
      ],
      sections: [
        { id: 'sec-1', name: 'A', departmentId: 'dept-1', createdBy: 'old-sa-id', universityId: 'uni-1' },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, {});
    expect(res.success).toBe(true);

    const deptsUpsert = h.upserts.find((u) => u.table === 'departments');
    expect(deptsUpsert).toBeDefined();
    expect(deptsUpsert!.payload[0].created_by).toBe('caller-1'); // remapped to active session super_admin

    const secsUpsert = h.upserts.find((u) => u.table === 'sections');
    expect(secsUpsert).toBeDefined();
    expect(secsUpsert!.payload[0].created_by).toBe('caller-1');
  });

  it('sanitizes dangling admin_id and primary_teacher_id to null when users do not exist', async () => {
    h.selectResolver = () => ({ data: [], error: null });

    const settings = {
      ...emptySettings(),
      users: [],
      departments: [
        { id: 'dept-1', name: 'CS', code: 'CS', adminId: 'ghost-user', universityId: 'uni-1' },
      ],
      sections: [
        { id: 'sec-1', name: 'A', departmentId: 'dept-1', primaryTeacherId: 'nonexistent-user', universityId: 'uni-1' },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, {});
    expect(res.success).toBe(true);

    const deptsUpsert = h.upserts.find((u) => u.table === 'departments');
    expect(deptsUpsert!.payload[0].admin_id).toBeNull();

    const secsUpsert = h.upserts.find((u) => u.table === 'sections');
    expect(secsUpsert!.payload[0].primary_teacher_id).toBeNull();
  });

  it('deduplicates user_sections and user_subjects after ID remapping', async () => {
    // Both bu-1 and bu-2 match the existing user ex-1
    h.selectResolver = (table: string) => {
      if (table === 'users') return { data: [{ id: 'ex-1', email: 'same@uni.com' }], error: null };
      return { data: [], error: null };
    };

    const settings = {
      ...emptySettings(),
      users: [
        { id: 'bu-1', role: 'regular_teacher', email: 'same@uni.com' },
        { id: 'bu-2', role: 'regular_teacher', email: 'same@uni.com' },
      ],
    };

    const data = {
      userSections: [
        { id: 'us-1', userId: 'bu-1', sectionId: 'sec-1', userRole: 'teacher', universityId: 'uni-1' },
        { id: 'us-2', userId: 'bu-2', sectionId: 'sec-1', userRole: 'teacher', universityId: 'uni-1' },
      ],
      userSubjects: [
        { id: 'sub-1', userId: 'bu-1', subjectId: 'sub-1', sectionId: 'sec-1', universityId: 'uni-1' },
        { id: 'sub-2', userId: 'bu-2', subjectId: 'sub-1', sectionId: 'sec-1', universityId: 'uni-1' },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, data);
    expect(res.success).toBe(true);

    const userSectionsUpsert = h.upserts.find((u) => u.table === 'user_sections');
    expect(userSectionsUpsert!.payload).toHaveLength(1);
    expect(userSectionsUpsert!.payload[0].user_id).toBe('ex-1');

    const userSubjectsUpsert = h.upserts.find((u) => u.table === 'user_subjects');
    expect(userSubjectsUpsert!.payload).toHaveLength(1);
    expect(userSubjectsUpsert!.payload[0].user_id).toBe('ex-1');
  });

  it('rejects duplicate attendance sessions with identical (subject_id, date, period_number)', async () => {
    h.selectResolver = () => ({ data: [], error: null });

    const settings = emptySettings();
    const data = {
      attendanceSessions: [
        { id: 'sess-1', subjectId: 'sub-1', date: '2026-08-31', periodNumber: 1, universityId: 'uni-1' },
        { id: 'sess-2', subjectId: 'sub-1', date: '2026-08-31', periodNumber: 1, universityId: 'uni-1' },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, data);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Duplicate attendance session found in backup');
  });

  it('preserves revision field on attendance sessions', async () => {
    h.selectResolver = () => ({ data: [], error: null });

    const settings = emptySettings();
    const data = {
      attendanceSessions: [
        { id: 'sess-1', subjectId: 'sub-1', date: '2026-08-31', periodNumber: 1, revision: 7, universityId: 'uni-1' },
      ],
    };

    const res = await restoreUniversityData('uni-1', settings, data);
    expect(res.success).toBe(true);

    const attUpsert = h.upserts.find((u) => u.table === 'attendance_sessions');
    expect(attUpsert!.payload[0].revision).toBe(7);
  });
});

