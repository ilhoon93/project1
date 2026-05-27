'use client';

import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { coverContent, type SampleDesign } from '@/lib/marketing/sample-invitations';

/**
 * 마케팅 화면에서 실제 알림장 렌더러(InvitationSlides)를 그대로 띄우는 래퍼.
 * 에디터 좌측 미리보기와 동일하게 isPreview(서버 호출 차단) + scoped(부모 박스
 * 안에서만 렌더)로 동작한다. 부모가 폰 프레임 크기를 잡아주면 그 안을 채운다.
 *
 * cover=true 면 메인 슬라이드(표지) 한 장만 — 히어로/카탈로그 카드용.
 * cover=false 면 전체 슬라이드 — 모달 풀 미리보기용(폰 안에서 스크롤).
 */
export function InvitationPreview({
  design,
  cover = false,
}: {
  design: SampleDesign;
  cover?: boolean;
}) {
  const content = cover ? coverContent(design.content) : design.content;
  return (
    <InvitationSlides
      invitationId={`sample-${design.id}`}
      groomName={design.groomName}
      brideName={design.brideName}
      weddingDate={design.weddingDate}
      content={content}
      isPreview
      scoped
    />
  );
}
