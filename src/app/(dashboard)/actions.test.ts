import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  caller: null as any,
  createdAuthUsers: [] as any[],
  upserts: [] as Array<{ table: string; payload: any }>,
  updates: [] as Array<{ table: string; payload: any; column: string; value: any }>,
  bannedUserIds: [] as Array<{ userId: string; attributes: any }>,
  targetProfile: { data: null as any, error: null as any },
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  getVerifiedCaller: async () => h.caller,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (tableName: string) => ({
      upsert: (payload: any) => {
        h.upserts.push({ table: tableName, payload });
        return Promise.resolve({ data: null, error: null });
      },
      update: (payload: any) => ({
        eq: (column: string, value: any) => {
          h.updates.push({ table: tableName, payload, column, value });
          return Promise.resolve({ data: null, error: null });
        },
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => h.targetProfile,
        }),
      }),
    }),
    auth: {
      admin: {
        createUser: async (args: any) => {
          h.createdAuthUsers.push(args);
          return {
            data: { user: { id: `new-auth-${h.createdAuthUsers.length}`, email: args.email } },
            error: null,
          };
        },
        updateUserById: async (userId: string, attributes: any) => {
          h.bannedUserIds.push({ userId, attributes });
          return { data: { user: { id: userId } }, error: null };
        },
      },
    },
  }),
}));

import {
  createManagedAuthUser,
  createManagedUserProfile,
  deactivateManagedAuthUser,
  resetManagedUserPassword,
} from './actions';

beforeEach(() => {
  h.caller = null;
  h.createdAuthUsers = [];
  h.upserts = [];
  h.updates = [];
  h.bannedUserIds = [];
  h.targetProfile = { data: null, error: null };
});

describe('createManagedAuthUser authorization (F-003)', () => {
  const input = { email: 'new@uni.com', password: 'Temp-abcd1234' };

  it('rejects unauthenticated callers without creating anything', async () => {
    const res = await createManagedAuthUser(input);
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('rejects low-privilege roles (cr, regular_teacher)', async () => {
    h.caller = { userId: 'u-cr', role: 'cr', universityId: 'uni-1' };
    expect((await createManagedAuthUser(input)).success).toBe(false);

    h.caller = { userId: 'u-rt', role: 'regular_teacher', universityId: 'uni-1' };
    expect((await createManagedAuthUser(input)).success).toBe(false);

    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('allows super_admin, admin and primary_teacher callers', async () => {
    for (const role of ['super_admin', 'admin', 'primary_teacher']) {
      h.caller = { userId: `u-${role}`, role, universityId: 'uni-1' };
      const res = await createManagedAuthUser(input);
      expect(res.success).toBe(true);
    }
    expect(h.createdAuthUsers).toHaveLength(3);
    expect(h.createdAuthUsers[0]).toEqual({ ...input, email_confirm: true });
  });
});

describe('createManagedUserProfile authorization (F-003)', () => {
  const baseInput = {
    id: 'target-uid',
    university_id: 'uni-1',
    full_name: 'Target Person',
    staff_id: 'ST-1',
    email: 'target@uni.com',
    department_id: null,
    is_active: true,
    must_change_password: true,
    created_at: '2026-08-22T00:00:00Z',
    created_by: 'spoofed-attacker-id',
  };

  it('rejects unauthenticated callers', async () => {
    const res = await createManagedUserProfile({ ...baseInput, role: 'cr' });
    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('never allows minting a super_admin profile through this action', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    const res = await createManagedUserProfile({ ...baseInput, role: 'super_admin' });
    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('enforces the privilege hierarchy (primary_teacher cannot create admins)', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    const res = await createManagedUserProfile({ ...baseInput, role: 'admin' });
    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('rejects callers from a different university', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-other' };
    const res = await createManagedUserProfile({ ...baseInput, role: 'cr' });
    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('overrides created_by with the verified caller id', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    const res = await createManagedUserProfile({ ...baseInput, role: 'cr' });
    expect(res.success).toBe(true);
    expect(h.upserts[0].payload.created_by).toBe('u-pt');
    expect(h.upserts[0].payload.role).toBe('cr');
  });

  it('lets a super_admin create admin profiles in their own university', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    const res = await createManagedUserProfile({ ...baseInput, role: 'admin' });
    expect(res.success).toBe(true);
    expect(h.upserts[0].payload.role).toBe('admin');
  });
});

describe('deactivateManagedAuthUser authorization (F-003)', () => {
  const call = (userId: string) => deactivateManagedAuthUser(userId);

  it('rejects unauthenticated callers', async () => {
    expect((await call('victim')).success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('prevents self-deactivation', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'u-sa', role: 'super_admin', university_id: 'uni-1' },
      error: null,
    };
    const res = await call('u-sa');
    expect(res.success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('refuses targets outside the caller university or super_admin targets', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };

    h.targetProfile = {
      data: { id: 'victim', role: 'admin', university_id: 'uni-other' },
      error: null,
    };
    expect((await call('victim')).success).toBe(false);

    h.targetProfile = {
      data: { id: 'sa2', role: 'super_admin', university_id: 'uni-1' },
      error: null,
    };
    expect((await call('sa2')).success).toBe(false);

    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('does not let an admin deactivate another admin', async () => {
    h.caller = { userId: 'u-adm', role: 'admin', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'adm2', role: 'admin', university_id: 'uni-1' },
      error: null,
    };
    expect((await call('adm2')).success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('lets a super_admin deactivate an admin of their own university', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'old-admin', role: 'admin', university_id: 'uni-1' },
      error: null,
    };
    const res = await call('old-admin');
    expect(res.success).toBe(true);
    expect(h.bannedUserIds).toHaveLength(1);
    expect(h.bannedUserIds[0].userId).toBe('old-admin');
    expect(h.bannedUserIds[0].attributes.ban_duration).toBe('876000h');
  });

  it('lets a primary_teacher deactivate a CR of their own university', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'cr-1', role: 'cr', university_id: 'uni-1' },
      error: null,
    };
    const res = await call('cr-1');
    expect(res.success).toBe(true);
    expect(h.bannedUserIds).toHaveLength(1);
    expect(h.bannedUserIds[0].userId).toBe('cr-1');
  });

  it('does not let a primary_teacher deactivate another teacher or admin', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 't-2', role: 'regular_teacher', university_id: 'uni-1' },
      error: null,
    };
    expect((await call('t-2')).success).toBe(false);

    h.targetProfile = {
      data: { id: 'adm-1', role: 'admin', university_id: 'uni-1' },
      error: null,
    };
    expect((await call('adm-1')).success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });
});

describe('resetManagedUserPassword authorization and functionality', () => {
  const callReset = (userId: string, pwd?: string) => resetManagedUserPassword(userId, pwd);

  it('rejects unauthenticated callers', async () => {
    expect((await callReset('cr-1')).success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('prevents self-password reset via admin action', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'u-sa', role: 'super_admin', staff_id: 'SA-01', university_id: 'uni-1' },
      error: null,
    };
    const res = await callReset('u-sa');
    expect(res.success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('rejects targets in a different university', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'cr-other', role: 'cr', staff_id: 'CR-99', university_id: 'uni-other' },
      error: null,
    };
    const res = await callReset('cr-other');
    expect(res.success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('lets a primary_teacher reset a CR password to their staffId by default', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'cr-1', role: 'cr', staff_id: 'CR-101', university_id: 'uni-1' },
      error: null,
    };
    const res = await callReset('cr-1');
    expect(res.success).toBe(true);
    expect(h.bannedUserIds).toHaveLength(1);
    expect(h.bannedUserIds[0].userId).toBe('cr-1');
    expect(h.bannedUserIds[0].attributes.password).toBe('CR-101');
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toEqual({
      table: 'users',
      payload: { must_change_password: true },
      column: 'id',
      value: 'cr-1',
    });
  });

  it('lets a primary_teacher provide a custom reset password for a CR', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 'cr-1', role: 'cr', staff_id: 'CR-101', university_id: 'uni-1' },
      error: null,
    };
    const res = await callReset('cr-1', 'NewSecurePass123!');
    expect(res.success).toBe(true);
    expect(h.bannedUserIds[0].attributes.password).toBe('NewSecurePass123!');
  });

  it('does not let a primary_teacher reset passwords of teachers or admins', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 't-1', role: 'regular_teacher', staff_id: 'T-01', university_id: 'uni-1' },
      error: null,
    };
    expect((await callReset('t-1')).success).toBe(false);
    expect(h.bannedUserIds).toHaveLength(0);
  });

  it('lets an admin reset a teacher password but not another admin', async () => {
    h.caller = { userId: 'u-adm', role: 'admin', universityId: 'uni-1' };
    h.targetProfile = {
      data: { id: 't-1', role: 'primary_teacher', staff_id: 'T-01', university_id: 'uni-1' },
      error: null,
    };
    const teacherRes = await callReset('t-1');
    expect(teacherRes.success).toBe(true);

    h.targetProfile = {
      data: { id: 'adm-2', role: 'admin', staff_id: 'ADM-02', university_id: 'uni-1' },
      error: null,
    };
    const adminRes = await callReset('adm-2');
    expect(adminRes.success).toBe(false);
  });
});

describe('server-side input validation (F-029)', () => {
  const authInput = { email: 'new@uni.com', password: 'Temp-abcd1234' };

  it.each([
    ['invalid email', { ...authInput, email: 'nope' }],
    ['short password', { ...authInput, password: 'short' }],
    ['over-long password', { ...authInput, password: 'x'.repeat(73) }],
  ])('createManagedAuthUser rejects %s without calling the auth API', async (_label, bad) => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    const res = await createManagedAuthUser(bad as typeof authInput);
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('createManagedAuthUser passes trimmed email through to the auth API', async () => {
    h.caller = { userId: 'u-sa', role: 'super_admin', universityId: 'uni-1' };
    const res = await createManagedAuthUser({ ...authInput, email: '  new@uni.com ' });
    expect(res.success).toBe(true);
    expect(h.createdAuthUsers[0].email).toBe('new@uni.com');
  });

  it('createManagedUserProfile rejects whitespace-only names before any upsert', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    const baseInput = {
      id: 'target-uid',
      university_id: 'uni-1',
      full_name: '   ',
      staff_id: 'ST-1',
      email: 'target@uni.com',
      department_id: null,
      is_active: true,
      must_change_password: true,
      created_at: '2026-08-22T00:00:00Z',
      created_by: 'spoofed',
    };
    const res = await createManagedUserProfile({ ...baseInput, role: 'cr' });
    expect(res.success).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it('createManagedUserProfile persists trimmed profile fields', async () => {
    h.caller = { userId: 'u-pt', role: 'primary_teacher', universityId: 'uni-1' };
    const baseInput = {
      id: 'target-uid',
      university_id: 'uni-1',
      full_name: ' Target Person ',
      staff_id: ' ST-1 ',
      email: ' target@uni.com ',
      department_id: null,
      is_active: true,
      must_change_password: true,
      created_at: '2026-08-22T00:00:00Z',
      created_by: 'spoofed',
    };
    const res = await createManagedUserProfile({ ...baseInput, role: 'cr' });
    expect(res.success).toBe(true);
    expect(h.upserts[0].payload.full_name).toBe('Target Person');
    expect(h.upserts[0].payload.staff_id).toBe('ST-1');
    expect(h.upserts[0].payload.email).toBe('target@uni.com');
  });
});
