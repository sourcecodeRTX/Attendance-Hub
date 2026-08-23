import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using service role key (bypasses RLS).
// NEVER import this file from client-side code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error(
      'Missing environment variable NEXT_PUBLIC_SUPABASE_URL: add it to .env.local (or your deployment environment) before using privileged server flows.'
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing environment variable SUPABASE_SERVICE_ROLE_KEY: add the service_role secret from your Supabase dashboard to .env.local (or your deployment environment) before using privileged server flows.'
    );
  }

  return createClient(url, serviceRoleKey);
}
