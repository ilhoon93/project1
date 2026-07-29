import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/invitations/[id]/mark-edited
 *
 * 계측 전용 — 사용자가 에디터에서 "처음으로 편집"했을 때 1회 호출된다.
 * invitation_edits 에 (invitation_id) 를 upsert 해 "편집 흔적 있음" 만 남긴다.
 *
 * - 자동저장이 아니다: content / groom·bride / updated_at 을 절대 건드리지 않으므로
 *   "저장됨" 판정(updated_at<>created_at)을 오염시키지 않는다.
 * - navigator.sendBeacon 으로 호출되는 fire-and-forget 라 응답 본문이 필요 없다(204).
 * - 소유 검증은 invitation_edits 의 insert RLS 정책(본인 알림장만)이 강제한다.
 * - 멱등: 이미 흔적이 있으면 무시(ignoreDuplicates).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 비로그인/오류는 조용히 무시 — 계측은 실패해도 본 흐름에 영향 없어야 한다.
  if (!user) return new NextResponse(null, { status: 204 });

  try {
    // invitation_edits 는 자동생성 DB 타입에 아직 없어 캐스팅(추가형 테이블).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('invitation_edits')
      .upsert(
        { invitation_id: params.id },
        { onConflict: 'invitation_id', ignoreDuplicates: true },
      );
  } catch {
    // 계측 실패는 무시.
  }

  return new NextResponse(null, { status: 204 });
}
