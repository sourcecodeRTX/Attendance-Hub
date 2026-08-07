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
