import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = ['/new', '/edit', '/preview', '/purchase', '/mypage'];
const AUTH_ONLY_PREFIXES = ['/login'];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const isAuthOnly = AUTH_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/new';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon, robots, sitemap
     * - any file with a static extension
     * The auth callback route IS matched (it must run through session refresh).
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
