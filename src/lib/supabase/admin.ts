import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using service role key (bypasses RLS).
// NEVER import this file from client-side code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
