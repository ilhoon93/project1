import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth callback. Supabase redirects here after the provider (Kakao)
 * completes its handshake. We exchange the auth code for a session
 * (which sets the auth cookies) and then forward the user to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDesc = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/new';

  if (errorDesc) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', errorDesc);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(url);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', error.message);
    return NextResponse.redirect(url);
  }

  // Only allow same-origin relative paths to prevent open-redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/new';
  return NextResponse.redirect(new URL(safeNext, origin));
}
