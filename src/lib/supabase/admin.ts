import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireEnv } from '@/lib/env';

/**
 * Service-role Supabase client. SERVER ONLY.
 *
 * Bypasses Row Level Security. Never import this from client code or
 * from any module that ends up in the client bundle. Reserve for:
 *   - guest data ingest (anonymous writes from public invitation pages)
 *   - admin operations (cleanup, backfills, webhooks)
 */
export const createAdminClient = () =>
  createSupabaseClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
