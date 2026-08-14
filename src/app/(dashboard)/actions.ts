'use server';

import { createAdminClient } from '@/lib/supabase/admin';

interface CreateManagedAuthUserInput {
  email: string;
  password: string;
}

interface CreateManagedAuthUserResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function createManagedAuthUser(
  input: CreateManagedAuthUserInput
): Promise<CreateManagedAuthUserResult> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
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

export async function createManagedUserProfile(
  input: CreateManagedUserProfileInput
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  const { error } = await adminClient.from('users').upsert({
    id: input.id,
    university_id: input.university_id,
    role: input.role,
    full_name: input.full_name,
    staff_id: input.staff_id,
    email: input.email,
    department_id: input.department_id,
    is_active: input.is_active,
    must_change_password: input.must_change_password,
    created_at: input.created_at,
    created_by: input.created_by,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deactivateManagedAuthUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

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
