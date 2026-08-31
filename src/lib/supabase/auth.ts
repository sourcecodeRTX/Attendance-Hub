import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from './client';

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
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
