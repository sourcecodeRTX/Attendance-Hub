import { describe, it, expect } from 'vitest';
import {
  SUPABASE_AUTH_COOKIE_PATTERN,
  hasSupabaseAuthCookie,
  isProtectedPath,
} from './middleware';
import type { NextRequest } from 'next/server';

function createMockRequest(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
    },
  } as unknown as NextRequest;
}

describe('Middleware auth cookie heuristic (F-031)', () => {
  it('matches valid standard and chunked Supabase auth cookie names', () => {
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-projectref-auth-token')).toBe(true);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-12345678-auth-token')).toBe(true);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-app_dev-auth-token')).toBe(true);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-projectref-auth-token.0')).toBe(true);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-projectref-auth-token.1')).toBe(true);
  });

  it('rejects unrelated or spoofed cookies that contain -auth-token as a substring', () => {
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('attacker-auth-token')).toBe(false);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('custom-auth-token')).toBe(false);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('my-auth-token-cookie')).toBe(false);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('auth-token')).toBe(false);
    expect(SUPABASE_AUTH_COOKIE_PATTERN.test('sb-token')).toBe(false);
  });

  it('hasSupabaseAuthCookie returns true when a valid non-empty Supabase auth cookie exists', () => {
    const req = createMockRequest({
      'sb-xyz123-auth-token': 'valid-jwt-token-string',
      theme: 'dark',
    });
    expect(hasSupabaseAuthCookie(req)).toBe(true);
  });

  it('hasSupabaseAuthCookie returns false when cookie value is empty or whitespace-only', () => {
    const emptyReq = createMockRequest({
      'sb-xyz123-auth-token': '',
    });
    expect(hasSupabaseAuthCookie(emptyReq)).toBe(false);

    const whitespaceReq = createMockRequest({
      'sb-xyz123-auth-token': '   ',
    });
    expect(hasSupabaseAuthCookie(whitespaceReq)).toBe(false);
  });

  it('hasSupabaseAuthCookie returns false for unrelated cookies containing -auth-token', () => {
    const req = createMockRequest({
      'thirdparty-auth-token': 'some-value',
      'unrelated-cookie': '123',
    });
    expect(hasSupabaseAuthCookie(req)).toBe(false);
  });
});

describe('Middleware isProtectedPath', () => {
  it('protects core dashboard and management routes', () => {
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/attendance')).toBe(true);
    expect(isProtectedPath('/students')).toBe(true);
    expect(isProtectedPath('/teachers')).toBe(true);
    expect(isProtectedPath('/subjects')).toBe(true);
    expect(isProtectedPath('/cr-management')).toBe(true);
    expect(isProtectedPath('/backup')).toBe(true);
    expect(isProtectedPath('/settings')).toBe(true);
  });

  it('allows public landing and auth routes', () => {
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/login')).toBe(false);
    expect(isProtectedPath('/register')).toBe(false);
    expect(isProtectedPath('/forgot-password')).toBe(false);
  });

  it('allows static Next.js assets, icons, and well-known paths', () => {
    expect(isProtectedPath('/_next/static/chunks/main.js')).toBe(false);
    expect(isProtectedPath('/_next/image')).toBe(false);
    expect(isProtectedPath('/favicon.ico')).toBe(false);
    expect(isProtectedPath('/manifest.json')).toBe(false);
    expect(isProtectedPath('/icons/icon-192.png')).toBe(false);
    expect(isProtectedPath('/.well-known/assetlinks.json')).toBe(false);
    expect(isProtectedPath('/api/health')).toBe(false);
  });
});
