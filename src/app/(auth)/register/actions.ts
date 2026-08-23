'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { registerSchema } from '@/lib/utils/validation';

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  staffId: string;
  universityName: string;
  universityCode: string;
}

interface RegisterResult {
  success: boolean;
  error?: string;
}

export async function registerUniversity(input: RegisterInput): Promise<RegisterResult> {
  // Server-side re-validation: the client form is not a trust boundary.
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid registration details.',
    };
  }
  const values = parsed.data;

  const adminClient = createAdminClient();

  // Step 1: Check if university code is already taken (fast-fail)
  const { data: uniByCode } = await adminClient
    .from('universities')
    .select('id')
    .eq('code', values.universityCode.toUpperCase())
    .maybeSingle();

  if (uniByCode) {
    return {
      success: false,
      error: `University code "${values.universityCode.toUpperCase()}" is already taken. Please choose a different code.`,
    };
  }

  // Step 2: Create auth user via admin API (no email confirmation needed,
  // no session side effects on the server, fully atomic)
  let uid: string;
  let authUserCreated = false;

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true, // auto-confirm so user can log in immediately
  });

  if (authError) {
    // If user already exists in auth, try to recover
    if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
      // Look up the existing auth user by email
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = usersList?.users?.find(
        (u) => u.email === values.email
      );

      if (!existingAuthUser) {
        return { success: false, error: 'Email is registered but user cannot be found. Please contact support.' };
      }

      uid = existingAuthUser.id;

      // Check if this user already has a complete profile
      const { data: existingProfile } = await adminClient
        .from('users')
        .select('id, university_id')
        .eq('id', uid)
        .maybeSingle();

      if (existingProfile) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in instead.',
        };
      }

      // Auth user exists but no profile — continue to create university + profile
    } else {
      return { success: false, error: `Failed to create account: ${authError.message}` };
    }
  } else {
    uid = authData.user?.id ?? '';
    if (!uid) {
      return { success: false, error: 'Failed to create account' };
    }
    authUserCreated = true;
  }

  // Step 3: Check for orphaned university (partial previous registration)
  const { data: existingUniversity } = await adminClient
    .from('universities')
    .select('id')
    .eq('super_admin_id', uid)
    .maybeSingle();

  let universityId: string;

  if (existingUniversity) {
    universityId = existingUniversity.id;
  } else {
    universityId = crypto.randomUUID();

    const { error: uniError } = await adminClient.from('universities').insert({
      id: universityId,
      name: values.universityName,
      code: values.universityCode.toUpperCase(),
      super_admin_id: uid,
      attendance_threshold: 75,
    });

    if (uniError) {
      // Rollback: delete auth user if we just created it
      if (authUserCreated) {
        await adminClient.auth.admin.deleteUser(uid);
      }
      return { success: false, error: `Failed to create university: ${uniError.message}` };
    }
  }

  // Step 4: Create the user profile in public.users
  const { error: userError } = await adminClient.from('users').insert({
    id: uid,
    university_id: universityId,
    role: 'super_admin',
    full_name: values.fullName,
    staff_id: values.staffId,
    email: values.email,
    is_active: true,
    must_change_password: false,
  });

  if (userError) {
    // Rollback: delete university if we just created it, then delete auth user
    if (!existingUniversity) {
      await adminClient.from('universities').delete().eq('id', universityId);
    }
    if (authUserCreated) {
      await adminClient.auth.admin.deleteUser(uid);
    }
    return { success: false, error: `Failed to create user profile: ${userError.message}` };
  }

  return { success: true };
}
