import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getImageEditStatus } from '@/lib/fal/client';

/**
 * GET /api/snap/status?id=<requestId>
 *
 * 웨딩스냅 큐 작업 상태 조회 — fal.ai 큐 API 가 모델 무관이라 기존
 * /api/ai/concept-status 와 동일한 동작이지만, snap 흐름에 맞춰 별도 라우트로
 * 둬서 추후 인증/요금/로깅을 분리해 진화시킬 수 있게 한다.
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
    console.error('[snap/status] fal.queue.status error', e);
    return NextResponse.json(
      { error: '상태 조회에 실패했습니다.' },
      { status: 502 },
    );
  }
}
