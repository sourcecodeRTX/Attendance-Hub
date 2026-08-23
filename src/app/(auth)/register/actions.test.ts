import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  createdAuthUsers: [] as any[],
  universityInserts: [] as any[],
  userInserts: [] as any[],
  uniByCode: { data: null as any },
  authError: null as any,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'universities' ? h.uniByCode : { data: null },
        }),
      }),
      insert: async (payload: any) => {
        if (table === 'universities') h.universityInserts.push(payload);
        else h.userInserts.push(payload);
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    auth: {
      admin: {
        createUser: async (args: any) => {
          h.createdAuthUsers.push(args);
          return {
            data: { user: { id: 'new-uid', email: args.email } },
            error: h.authError,
          };
        },
        listUsers: async () => ({ data: { users: [] } }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  }),
}));

import { registerUniversity } from './actions';

const validInput = {
  fullName: 'Ada Lovelace',
  staffId: 'S-001',
  email: 'ada@example.edu',
  password: 'correcthorse',
  universityName: 'Example University',
  universityCode: 'EXU',
};

beforeEach(() => {
  h.createdAuthUsers.length = 0;
  h.universityInserts.length = 0;
  h.userInserts.length = 0;
  h.uniByCode = { data: null };
  h.authError = null;
});

describe('registerUniversity server-side validation (F-029)', () => {
  it('rejects whitespace-only names before any client call', async () => {
    const res = await registerUniversity({ ...validInput, fullName: '   ' });
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
    expect(h.universityInserts).toHaveLength(0);
    expect(h.userInserts).toHaveLength(0);
  });

  it('rejects over-long passwords before any client call', async () => {
    const res = await registerUniversity({ ...validInput, password: 'x'.repeat(73) });
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('rejects invalid emails before any client call', async () => {
    const res = await registerUniversity({ ...validInput, email: 'not-an-email' });
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
  });

  it('persists trimmed values for valid input', async () => {
    const res = await registerUniversity({
      ...validInput,
      fullName: '  Ada Lovelace ',
      staffId: ' S-001',
      universityCode: ' exu ',
    });
    expect(res.success).toBe(true);
    expect(h.createdAuthUsers[0].email).toBe('ada@example.edu');
    expect(h.userInserts[0].full_name).toBe('Ada Lovelace');
    expect(h.userInserts[0].staff_id).toBe('S-001');
    expect(h.universityInserts[0].code).toBe('EXU');
  });

  it('still rejects already-taken university codes', async () => {
    h.uniByCode = { data: { id: 'existing' } };
    const res = await registerUniversity(validInput);
    expect(res.success).toBe(false);
    expect(h.createdAuthUsers).toHaveLength(0);
  });
});
