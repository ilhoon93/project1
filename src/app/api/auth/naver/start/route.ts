import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { buildNaverAuthorizeUrl } from '@/lib/naver/oauth';

const STATE_COOKIE = 'naver_oauth_state';
const NEXT_COOKIE = 'naver_oauth_next';

/**
 * GET /api/auth/naver/start?next=/mypage
 *
 * Issues a CSRF state cookie + redirects to Naver's consent screen.
 * If Naver env vars are missing, redirect back to /login with a friendly
 * error code (instead of throwing → 500). The callback at
 * /api/auth/naver/callback will validate the state.
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/mypage';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/mypage';

  // Pre-flight env check so a misconfigured server doesn't 500.
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    const u = new URL('/login', url.origin);
    u.searchParams.set('error', 'naver_not_configured');
    return NextResponse.redirect(u);
  }

  let authorizeUrl: string;
  const state = randomBytes(16).toString('hex');
  const redirectUri = `${url.origin}/api/auth/naver/callback`;
  try {
    authorizeUrl = buildNaverAuthorizeUrl(state, redirectUri);
  } catch (e) {
    console.error('[naver/start] buildAuthorizeUrl failed', e);
    const u = new URL('/login', url.origin);
    u.searchParams.set('error', 'naver_start_failed');
    return NextResponse.redirect(u);
  }

  const res = NextResponse.redirect(authorizeUrl);

  const cookieOpts = {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  };
  res.cookies.set(STATE_COOKIE, state, cookieOpts);
  res.cookies.set(NEXT_COOKIE, safeNext, cookieOpts);
  return res;
}
