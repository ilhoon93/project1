/**
 * GET  /api/snap/consent  → 현재 사용자의 동의 상태 조회
 * POST /api/snap/consent  → 동의 기록
 *
 * 본 라우트는 SnapGenerator 의 동의 모달과 짝을 이룸. snap 생성 라우트가
 * 직접 hasRequiredConsent 로 차단하지만, UI 흐름상 미리 확인/기록하기 위한 endpoint.
 */

import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  acceptConsent,
  hasRequiredConsent,
  SNAP_CONSENT_VERSION,
  type ConsentScope,
} from '@/lib/snap/consent';

const NO_STORE_HEADERS = { 'cache-control': 'no-store' } as const;

const BodySchema = z.object({
  scopes: z
    .array(z.enum(['personal_info', 'ai_generation', 'external_share']))
    .min(1),
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const ok = await hasRequiredConsent(user.id);
  return NextResponse.json(
    { hasConsent: ok, currentVersion: SNAP_CONSENT_VERSION },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  let input: { scopes: ConsentScope[] };
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: e.issues },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  // 필수 scope 검증.
  if (
    !input.scopes.includes('personal_info') ||
    !input.scopes.includes('ai_generation')
  ) {
    return NextResponse.json(
      {
        error: '필수 동의 항목(개인정보 처리 / AI 합성 처리) 모두 체크해주세요.',
        code: 'required_scope_missing',
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    await acceptConsent({
      userId: user.id,
      scopes: input.scopes,
      userAgent: req.headers.get('user-agent'),
      // IP 는 Vercel/proxy 헤더 우선, fallback NextRequest 의 ip (Vercel edge).
      ipAddress:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
    });
  } catch (e) {
    console.error('[consent] accept failed', e);
    return NextResponse.json(
      { error: '동의 저장에 실패했습니다. 다시 시도해 주세요.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
