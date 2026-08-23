import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { createAdminClient } from './admin';

describe('createAdminClient configuration guard', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    createClientMock.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws an actionable error naming SUPABASE_SERVICE_ROLE_KEY when it is unset', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(() => createAdminClient()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only SUPABASE_SERVICE_ROLE_KEY as missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '   ';
    expect(() => createAdminClient()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('throws an actionable error naming NEXT_PUBLIC_SUPABASE_URL when it is unset', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    expect(() => createAdminClient()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('creates the client with both values when configuration is present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    createAdminClient();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-key'
    );
  });
});
