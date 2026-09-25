import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exiojmrifluuyuwgqtjj.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4kNBRAeYNjGnvSZoY79NmA_W1u0eIuX';

  return createBrowserClient(supabaseUrl, supabaseKey);
}
