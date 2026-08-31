import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const resetPasswordForEmailMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail: resetPasswordForEmailMock },
  }),
}));

import { resetPasswordForEmail } from './auth';

describe('resetPasswordForEmail redirect target', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetPasswordForEmailMock.mockClear();
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('prefers NEXT_PUBLIC_APP_URL when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    await resetPasswordForEmail('user@example.com');
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.example.com/change-password',
    });
  });

  it('strips trailing slashes from NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/';
    await resetPasswordForEmail('user@example.com');
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.example.com/change-password',
    });
  });

  it('falls back to the current browser origin when NEXT_PUBLIC_APP_URL is unset', async () => {
    await resetPasswordForEmail('user@example.com');
    expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    const [, options] = resetPasswordForEmailMock.mock.calls[0];
    expect(options?.redirectTo).toBe(`${window.location.origin}/change-password`);
    expect(options?.redirectTo).not.toContain('undefined');
  });

  it('omits redirectTo entirely outside a browser and with no configured URL', async () => {
    vi.stubGlobal('window', undefined);
    await resetPasswordForEmail('user@example.com');
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com');
  });
});
