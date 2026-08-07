'use server';

import { createAdminClient } from '@/lib/supabase/admin';

interface CompleteProfileInput {
  userId: string;
  email: string;
  fullName?: string;
}

interface CompleteProfileResult {
  success: boolean;
  error?: string;
  needsRegistration?: boolean;
}

export async function completeOrphanedProfile(input: CompleteProfileInput): Promise<CompleteProfileResult> {
  const adminClient = createAdminClient();

  // Check if user profile already exists (race condition guard)
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', input.userId)
    .maybeSingle();

  if (existingUser) {
    return { success: true };
  }

  // Check if this user is a super_admin with an orphaned university
  const { data: existingUniversity } = await adminClient
    .from('universities')
    .select('id')
    .eq('super_admin_id', input.userId)
    .maybeSingle();

  if (existingUniversity) {
    // Orphaned super_admin: university exists but user profile doesn't
    const { error: userError } = await adminClient.from('users').insert({
      id: input.userId,
      university_id: existingUniversity.id,
      role: 'super_admin',
      full_name: input.fullName || input.email.split('@')[0],
      staff_id: 'ADMIN-001',
      email: input.email,
      is_active: true,
      must_change_password: false,
    });

    if (userError) {
      return { success: false, error: `Failed to create user profile: ${userError.message}` };
    }

    return { success: true };
  }

  // No university found for this user — they're either:
  // 1. A managed user (teacher/CR) whose profile hasn't been created yet
  // 2. Someone who started registration but didn't finish
  return {
    success: false,
    needsRegistration: true,
    error: 'No account profile found. If you are a university admin, please register. If you are a teacher or CR, contact your department admin.',
  };
}

