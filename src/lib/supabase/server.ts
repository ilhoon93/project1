import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { requireEnv } from '@/lib/env';

/**
 * Server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers.
 *
 * Reads/writes auth cookies via Next's cookie store. The try/catch on
 * setAll is for Server Components, where setting cookies throws —
 * Server Components run during render and can't mutate response headers.
 * Auth state is still refreshed correctly via middleware in those cases.
 */
export const createClient = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore — being called from a Server Component
          }
        },
      },
    },
  );
};
