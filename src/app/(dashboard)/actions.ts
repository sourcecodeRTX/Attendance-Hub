'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedCaller } from '@/lib/supabase/server-auth';
import { managedAuthUserSchema, managedProfileSchema } from '@/lib/utils/validation';
import type { UserRole } from '@/lib/types';

interface CreateManagedAuthUserInput {
  email: string;
  password: string;
}

interface CreateManagedAuthUserResult {
  success: boolean;
  userId?: string;
  error?: string;
}

// Roles allowed to mint managed auth accounts. Mirrors the routes that
// legitimately call this action: /departments (super_admin), /teachers
// (admin), /cr-management (primary_teacher).
const MANAGED_AUTH_CALLER_ROLES: UserRole[] = ['super_admin', 'admin', 'primary_teacher'];

export async function createManagedAuthUser(
  input: CreateManagedAuthUserInput
): Promise<CreateManagedAuthUserResult> {
  const caller = await getVerifiedCaller();
  if (!caller || !MANAGED_AUTH_CALLER_ROLES.includes(caller.role as UserRole)) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const parsedCredentials = managedAuthUserSchema.safeParse({
    email: input.email,
    password: input.password,
  });
  if (!parsedCredentials.success) {
    return {
      success: false,
      error: parsedCredentials.error.issues[0]?.message ?? 'Invalid account details.',
    };
  }
  const { email, password } = parsedCredentials.data;

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { success: false, error: 'Failed to create managed auth user' };
  }

  return { success: true, userId };
}

interface CreateManagedUserProfileInput {
  id: string;
  university_id: string;
  role: string;
  full_name: string;
  staff_id: string;
  email: string;
  department_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  created_by: string;
}

// A caller may only create profiles strictly below their own privilege
// level; nobody can mint a super_admin through this action.
const CREATABLE_PROFILE_ROLES: Record<string, UserRole[]> = {
  super_admin: ['admin', 'primary_teacher', 'regular_teacher', 'cr'],
  admin: ['primary_teacher', 'regular_teacher', 'cr'],
  primary_teacher: ['cr'],
};

export async function createManagedUserProfile(
  input: CreateManagedUserProfileInput
): Promise<{ success: boolean; error?: string }> {
  const caller = await getVerifiedCaller();
  if (!caller) {
    return { success: false, error: 'Insufficient permissions.' };
  }
  const creatable = CREATABLE_PROFILE_ROLES[caller.role];
  if (
    !creatable ||
    caller.universityId !== input.university_id ||
    !creatable.includes(input.role as UserRole)
  ) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const parsedProfile = managedProfileSchema.safeParse({
    full_name: input.full_name,
    staff_id: input.staff_id,
    email: input.email,
  });
  if (!parsedProfile.success) {
    return {
      success: false,
      error: parsedProfile.error.issues[0]?.message ?? 'Invalid profile details.',
    };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.from('users').upsert({
    id: input.id,
    university_id: input.university_id,
    role: input.role,
    full_name: parsedProfile.data.full_name,
    staff_id: parsedProfile.data.staff_id,
    email: parsedProfile.data.email,
    department_id: input.department_id,
    is_active: input.is_active,
    must_change_password: input.must_change_password,
    created_at: input.created_at,
    created_by: caller.userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deactivateManagedAuthUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const caller = await getVerifiedCaller();
  if (!caller) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const allowedTargets = CREATABLE_PROFILE_ROLES[caller.role];
  if (!allowedTargets) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from('users')
    .select('id, role, university_id')
    .eq('id', userId)
    .maybeSingle();

  if (!target || target.university_id !== caller.universityId) {
    return { success: false, error: 'Insufficient permissions.' };
  }
  if (target.id === caller.userId) {
    return { success: false, error: 'Cannot deactivate your own account.' };
  }
  if (!allowedTargets.includes(target.role as UserRole)) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
    user_metadata: {
      disabled: true,
      deactivated_at: new Date().toISOString(),
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function resetManagedUserPassword(
  userId: string,
  newPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const caller = await getVerifiedCaller();
  if (!caller) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const allowedTargets = CREATABLE_PROFILE_ROLES[caller.role];
  if (!allowedTargets) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const adminClient = createAdminClient();

  const { data: target } = await adminClient
    .from('users')
    .select('id, role, staff_id, university_id')
    .eq('id', userId)
    .maybeSingle();

  if (!target || target.university_id !== caller.universityId) {
    return { success: false, error: 'Insufficient permissions.' };
  }
  if (target.id === caller.userId) {
    return { success: false, error: 'Cannot reset your own password via admin action.' };
  }
  if (!allowedTargets.includes(target.role as UserRole)) {
    return { success: false, error: 'Insufficient permissions.' };
  }

  const passwordToSet = newPassword?.trim() || target.staff_id;
  if (!passwordToSet || passwordToSet.length < 1) {
    return { success: false, error: 'Password cannot be empty.' };
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    password: passwordToSet,
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const { error: profileError } = await adminClient
    .from('users')
    .update({ must_change_password: true })
    .eq('id', userId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  return { success: true };
}
