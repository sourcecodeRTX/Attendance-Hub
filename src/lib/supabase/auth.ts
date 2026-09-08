import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from './client';

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

function isJwtExpired(token?: string): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export async function signOut() {
  const supabase = createClient();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // If there is no session, or the token is already expired/malformed,
    // skip the remote network call to /auth/v1/logout which would trigger a 403 bad_jwt error.
    if (!token || isJwtExpired(token)) {
      if (typeof (supabase.auth as any)._removeSession === 'function') {
        await (supabase.auth as any)._removeSession();
      } else {
        await supabase.auth.signOut({ scope: 'local' });
      }
      return { error: null };
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error && typeof (supabase.auth as any)._removeSession === 'function') {
      await (supabase.auth as any)._removeSession();
    }
    return { error: null };
  } catch {
    if (typeof (supabase.auth as any)._removeSession === 'function') {
      try {
        await (supabase.auth as any)._removeSession();
      } catch {}
    }
    return { error: null };
  }
}

export async function signUp(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

export async function getSession() {
  const supabase = createClient();
  return supabase.auth.getSession();
}

export async function getUser() {
  const supabase = createClient();
  return supabase.auth.getUser();
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  return supabase.auth.updateUser({ password });
}

function getPasswordResetRedirectTo(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    return `${configured}/change-password`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/+$/, '')}/change-password`;
  }
  return undefined;
}

export async function resetPasswordForEmail(email: string) {
  const supabase = createClient();
  const redirectTo = getPasswordResetRedirectTo();
  if (!redirectTo) {
    return supabase.auth.resetPasswordForEmail(email);
  }
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function createManagedUser(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase public environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)'
    );
  }
  // Use a throwaway client so signUp doesn't replace the admin's session
  const tempClient = createSupabaseClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'att-tracker-managed-user-temp-auth',
      },
    }
  );
  return tempClient.auth.signUp({ email, password });
}
