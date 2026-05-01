import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { optionalEnv } from '@/lib/env';

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
 *
 * 환경변수가 누락된 빌드/스모크 환경에서도 미들웨어가 매 요청마다 500을
 * 던지지 않도록, Supabase 설정이 없으면 인증 없이 그대로 통과시킨다.
 */
export async function updateSession(request: NextRequest) {
  const url = optionalEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = optionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return { response: NextResponse.next({ request }), user: null };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anon, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
