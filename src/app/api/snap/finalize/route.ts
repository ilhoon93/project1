import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { finalizeSnapJob } from '@/lib/snap/finalize';

/**
 * POST /api/snap/finalize
 *
 * 단일 finalize — 사용자가 페이지에 머무르며 폴링 후 호출. 새로운 비동기
 * 흐름에서는 /api/snap/jobs/poll-pending 이 mypage 진입 시 일괄 처리하므로
 * 이 엔드포인트는 호환성을 위해 유지.
 */

const BodySchema = z.object({
  requestId: z.string().min(1),
  catalogId: z.string().min(1).optional(),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const { url } = await finalizeSnapJob({
      userId: user.id,
      falRequestId: input.requestId,
      catalogId: input.catalogId ?? null,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[snap/finalize] error', e);
    const message = e instanceof Error ? e.message : 'finalize failed';
    // 502 (외부) 와 500 (내부) 구분 — fal result 실패는 502, storage 는 500.
    const status = message.startsWith('fal result fetch') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
