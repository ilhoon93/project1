import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Refreshes the auth session on every request and propagates the
 * updated cookies to the response. Returns the response and the
 * resolved user (or null).
 *
 * Per Supabase SSR docs: NEVER skip this in middleware — without it,
 * server components see stale tokens and `auth.getUser()` may fail
 * silently after the access token expires.
 *
 * The dance below (mutating both request.cookies and response.cookies)
 * ensures both the inbound Server Component reads AND the outbound
 * browser cookies get the refreshed values.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
