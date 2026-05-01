import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { requireEnv } from '@/lib/env';

export const createClient = () =>
  createBrowserClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
