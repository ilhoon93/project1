import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getImageEditStatus } from '@/lib/fal/client';

/**
 * GET /api/ai/concept-status?id=<requestId>
 *
 * fal.ai 큐 작업의 현재 상태를 조회한다 (0.5–1초). 클라이언트가 5초 간격 정도로
 * 폴링한다. status === 'COMPLETED' 가 되면 finalize 라우트로 결과를 가져간다.
 *
 * 인증된 사용자만 호출 가능 — 다만 requestId 자체는 fal.ai 가 내준 값이라
 * 사용자 ↔ requestId 매핑은 굳이 DB 에 저장하지 않고 stateless 로 둔다.
 */

export const maxDuration = 15;

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const requestId = url.searchParams.get('id');
  if (!requestId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { status, queuePosition } = await getImageEditStatus(requestId);
    return NextResponse.json({ status, queuePosition });
  } catch (e) {
    console.error('[ai/concept-status] fal.queue.status error', e);
    return NextResponse.json(
      { error: '상태 조회에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 },
    );
  }
}
