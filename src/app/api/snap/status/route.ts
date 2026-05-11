import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getImageEditResult, getImageEditStatus } from '@/lib/fal/client';

/**
 * GET /api/snap/status?id=<requestId>[&fetchUrl=1]
 *
 * 웨딩스냅 큐 작업 상태 조회. COMPLETED 일 때 ?fetchUrl=1 (기본 on) 이면 결과
 * 이미지 URL 도 함께 반환한다 — 앵커 후보 4장을 폴링하면서 그대로 화면에 그려
 * 사용자가 고를 수 있도록 하기 위함. fal CDN URL 은 수명이 짧지만 후보 선택
 * UX 동안은 충분.
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
  const fetchUrl = url.searchParams.get('fetchUrl') !== '0';

  try {
    const { status, queuePosition } = await getImageEditStatus(requestId);
    let imageUrl: string | null = null;
    if (status === 'COMPLETED' && fetchUrl) {
      try {
        imageUrl = await getImageEditResult(requestId);
      } catch (e) {
        console.warn('[snap/status] result fetch failed', e);
      }
    }
    return NextResponse.json({ status, queuePosition, imageUrl });
  } catch (e) {
    console.error('[snap/status] fal.queue.status error', e);
    return NextResponse.json({ error: '상태 조회에 실패했습니다.' }, { status: 502 });
  }
}
