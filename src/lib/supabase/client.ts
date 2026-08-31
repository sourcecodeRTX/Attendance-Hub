import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<any, 'public', any> | null = null;

export function createClient(): SupabaseClient<any, 'public', any> {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase public environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)'
      );
    }
    client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export const supabase = createClient();
