import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /start?to=invitation | /start?to=snap
 *
 * 외부(네이버 스마트스토어 상세페이지·톡톡·QR 등)에 넣는 진입 링크.
 *   - 로그인 안 된 사용자 → 네이버 로그인(/api/auth/naver/start)으로 보내고,
 *     로그인 후 목적지로 자동 이동(next).
 *   - 이미 로그인된 사용자 → 곧장 목적지로 이동(다시 로그인시키지 않음).
 *
 * 목적지는 화이트리스트로만 매핑해 오픈 리다이렉트를 차단한다.
 *   invitation → /new                (알림장 바로 만들기: 빈 알림장 생성→편집기)
 *   snap       → /wedding-snap/create (AI 스냅 바로 만들기)
 */
const TARGETS: Record<string, string> = {
  invitation: '/new',
  snap: '/wedding-snap/create',
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const to = url.searchParams.get('to') ?? '';
  const target = TARGETS[to] ?? '/';

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // 이미 로그인 — 목적지로 직행.
    return NextResponse.redirect(new URL(target, url.origin));
  }

  // 미로그인 — 네이버 로그인 시작 라우트로. 로그인 후 next 로 자동 이동.
  const start = new URL('/api/auth/naver/start', url.origin);
  start.searchParams.set('next', target);
  return NextResponse.redirect(start);
}
