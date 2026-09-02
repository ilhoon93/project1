import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InvitationContent } from '@/types/invitation';

/**
 * "재발행 없이 저장만으로 즉시 반영돼야 하는 표시용 설정"을 원본(invitations.content)
 * 에서 가져오기 위한 유틸. (A안)
 *
 * 하객/소장용 페이지는 기본적으로 발행 스냅샷(publications.content)을 보여준다
 * — 편집 중 미완성 내용이 새어나가지 않도록 하기 위함. 다만 개인정보·콘텐츠와
 * 무관한 "순수 뷰 토글"은 저장 즉시 반영되는 편이 자연스럽다. 그런 값만 아래
 * 화이트리스트로 한정해 스냅샷 위에 덮어쓴다.
 *
 * 현재 화이트리스트:
 *   - gallery.allowZoom  (사진 확대 보기 on/off)
 */
export interface LiveDisplaySettings {
  galleryAllowZoom?: boolean;
  /** 이 알림장 소유자가 관리자 계정인지(진입 인트로 노출 조건 — 현재 테스트용). */
  ownerIsAdmin?: boolean;
}

/**
 * 원본 invitations 에서 화이트리스트 표시용 설정 + 소유자 관리자 여부를 읽어온다.
 * 익명(하객) 페이지에서도 읽어야 하므로 RLS 를 우회하는 service-role 로 조회하되,
 * content/소유자 role 외 필드는 건드리지 않는다. 실패 시 빈 객체 → 스냅샷 값 유지.
 */
export async function fetchLiveDisplaySettings(invitationId: string): Promise<LiveDisplaySettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('invitations')
      .select('content, user_id')
      .eq('id', invitationId)
      .maybeSingle();
    const gallery = (data?.content as { gallery?: { allowZoom?: unknown } } | null)?.gallery;
    const allowZoom = gallery?.allowZoom;

    let ownerIsAdmin = false;
    const ownerId = (data as { user_id?: string } | null)?.user_id;
    if (ownerId) {
      try {
        const { data: owner } = await admin.auth.admin.getUserById(ownerId);
        const role = (owner.user?.app_metadata as { role?: string } | undefined)?.role;
        ownerIsAdmin = role === 'admin';
      } catch {
        ownerIsAdmin = false;
      }
    }

    return {
      galleryAllowZoom: typeof allowZoom === 'boolean' ? allowZoom : undefined,
      ownerIsAdmin,
    };
  } catch {
    return {};
  }
}

/**
 * 파싱된 스냅샷 content 에 live 표시용 설정을 덮어쓴다(값이 있을 때만).
 * content 객체를 제자리(mutate)에서 수정하고 그대로 반환한다.
 */
export function applyLiveDisplaySettings(
  content: InvitationContent,
  live: LiveDisplaySettings,
): InvitationContent {
  if (typeof live.galleryAllowZoom === 'boolean') {
    content.gallery.allowZoom = live.galleryAllowZoom;
  }
  return content;
}
