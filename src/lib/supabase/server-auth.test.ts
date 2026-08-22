import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  }),
}));

import { getVerifiedCaller, requireUniversitySuperAdmin, getSessionUser } from './server-auth';

function mockCookies() {
  (cookies as any).mockReturnValue({
    getAll: () => [{ name: 'sb-test-auth-token', value: 'token' }],
    set: vi.fn(),
  });
}

describe('server-auth session verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies();
  });

  describe('getSessionUser', () => {
    it('returns null when there is no valid session', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
      await expect(getSessionUser()).resolves.toBeNull();
    });

    it('returns id and email from a verified session', async () => {
      getUserMock.mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.c' } },
        error: null,
      });
      await expect(getSessionUser()).resolves.toEqual({ id: 'u-1', email: 'a@b.c' });
    });
  });

  describe('getVerifiedCaller', () => {
    it('returns null when unauthenticated', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
      await expect(getVerifiedCaller()).resolves.toBeNull();
    });

    it('returns null when no profile row exists for the verified uid', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({ data: null });
      await expect(getVerifiedCaller()).resolves.toBeNull();
    });

    it('returns null when profile is inactive', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({
        data: { role: 'admin', university_id: 'uni-1', is_active: false },
      });
      await expect(getVerifiedCaller()).resolves.toBeNull();
    });

    it('returns role and university for an active verified caller', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({
        data: { role: 'super_admin', university_id: 'uni-1', is_active: true },
      });
      await expect(getVerifiedCaller()).resolves.toEqual({
        userId: 'u-1',
        role: 'super_admin',
        universityId: 'uni-1',
      });
    });
  });

  describe('requireUniversitySuperAdmin', () => {
    it('rejects unauthenticated callers', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'x' } });
      const res = await requireUniversitySuperAdmin('uni-1');
      expect(res.ok).toBe(false);
    });

    it('rejects callers who are not super_admin of the target university', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({
        data: { role: 'primary_teacher', university_id: 'uni-1', is_active: true },
      });
      const res = await requireUniversitySuperAdmin('uni-1');
      expect(res.ok).toBe(false);
    });

    it('rejects super_admins of a different university', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({
        data: { role: 'super_admin', university_id: 'uni-other', is_active: true },
      });
      const res = await requireUniversitySuperAdmin('uni-1');
      expect(res.ok).toBe(false);
    });

    it('accepts the matching super_admin and returns their verified uid', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
      maybeSingleMock.mockResolvedValue({
        data: { role: 'super_admin', university_id: 'uni-1', is_active: true },
      });
      const res = await requireUniversitySuperAdmin('uni-1');
      expect(res).toEqual({ ok: true, userId: 'u-1' });
    });
  });
});
