import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { buildNaverAuthorizeUrl } from '@/lib/naver/oauth';

const STATE_COOKIE = 'naver_oauth_state';
const NEXT_COOKIE = 'naver_oauth_next';

/**
 * GET /api/auth/naver/start?next=/mypage
 *
 * Issues a CSRF state cookie + redirects to Naver's consent screen.
 * Callback at /api/auth/naver/callback will validate the state.
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/mypage';

  const state = randomBytes(16).toString('hex');
  const redirectUri = `${url.origin}/api/auth/naver/callback`;

  const authorizeUrl = buildNaverAuthorizeUrl(state, redirectUri);
  const res = NextResponse.redirect(authorizeUrl);

  const cookieOpts = {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  };
  res.cookies.set(STATE_COOKIE, state, cookieOpts);
  res.cookies.set(NEXT_COOKIE, next.startsWith('/') ? next : '/mypage', cookieOpts);
  return res;
}
