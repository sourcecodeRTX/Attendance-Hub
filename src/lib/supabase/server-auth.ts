import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from './admin';

export interface SessionUser {
  id: string;
  email?: string;
}

export interface VerifiedCaller {
  userId: string;
  role: string;
  universityId: string | null;
}

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a context where setting cookies is not allowed
            // (e.g. RSC render). Token refresh will retry on the next request.
          }
        },
      },
    }
  );

  // getUser() revalidates the JWT against the Supabase Auth server,
  // unlike getSession() which trusts cookie contents alone.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function getVerifiedCaller(): Promise<VerifiedCaller | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('users')
    .select('role, university_id, is_active')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return {
    userId: sessionUser.id,
    role: profile.role,
    universityId: profile.university_id,
  };
}

export async function requireUniversitySuperAdmin(
  universityId: string
): Promise<GuardResult> {
  const caller = await getVerifiedCaller();
  if (!caller) {
    return { ok: false, error: 'Authentication required.' };
  }
  if (
    caller.role !== 'super_admin' ||
    caller.universityId !== universityId ||
    caller.universityId === null
  ) {
    return { ok: false, error: 'Insufficient permissions.' };
  }
  return { ok: true, userId: caller.userId };
}
