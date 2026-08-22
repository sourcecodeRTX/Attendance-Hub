import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  sessionUser: null as any,
  inserts: [] as Array<{ table: string; payload: any }>,
  tableData: {} as Record<string, { data: any; error: any }>,
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  getSessionUser: async () => h.sessionUser,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => h.tableData[table] ?? { data: null },
        }),
      }),
      insert: (payload: any) => {
        h.inserts.push({ table, payload });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

import { completeOrphanedProfile } from './actions';

beforeEach(() => {
  h.sessionUser = null;
  h.inserts = [];
  h.tableData = {};
});

describe('completeOrphanedProfile session-scoped identity (F-003)', () => {
  it('refuses without a verified session', async () => {
    const res = await completeOrphanedProfile();
    expect(res.success).toBe(false);
    expect(res.needsRegistration).toBe(true);
    expect(h.inserts).toHaveLength(0);
  });

  it('returns success without writing when a profile already exists', async () => {
    h.sessionUser = { id: 'u-1', email: 'me@uni.com' };
    h.tableData = { users: { data: { id: 'u-1' }, error: null } };

    const res = await completeOrphanedProfile();

    expect(res.success).toBe(true);
    expect(h.inserts).toHaveLength(0);
  });

  it('completes the CALLER profile only when the caller owns the orphaned university', async () => {
    h.sessionUser = { id: 'u-orphan', email: 'boss@uni.com' };
    h.tableData = {
      users: { data: null, error: null },
      universities: { data: { id: 'uni-9' }, error: null },
    };

    const res = await completeOrphanedProfile();

    expect(res.success).toBe(true);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].table).toBe('users');
    // The inserted profile is bound to the verified session identity,
    // never to any client-supplied uid.
    expect(h.inserts[0].payload.id).toBe('u-orphan');
    expect(h.inserts[0].payload.email).toBe('boss@uni.com');
    expect(h.inserts[0].payload.role).toBe('super_admin');
    expect(h.inserts[0].payload.university_id).toBe('uni-9');
  });

  it('reports needsRegistration when the caller has no orphaned university', async () => {
    h.sessionUser = { id: 'u-nobody', email: 'n@x.com' };
    h.tableData = {
      users: { data: null, error: null },
      universities: { data: null, error: null },
    };

    const res = await completeOrphanedProfile();

    expect(res.success).toBe(false);
    expect(res.needsRegistration).toBe(true);
    expect(h.inserts).toHaveLength(0);
  });
});
