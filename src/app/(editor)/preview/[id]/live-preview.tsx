'use client';

import {
  type InvitationContent,
} from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';

interface Props {
  invitationId: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  content: InvitationContent;
}

/**
 * /preview/[id] 는 "저장된 상태"를 그대로 보여주는 페이지다.
 * 에디터 툴바의 미리보기 버튼 팝업("미리보기에는 저장된 내용만 반영됩니다")
 * 약속을 지키기 위해 Zustand 스토어(미저장 편집분)는 절대 참조하지 않고
 * 서버에서 받은 props (= DB 저장본) 만 렌더링한다.
 *
 * 실시간 편집 미리보기는 에디터 페이지의 좌측 패널(EditorLivePreview) 이
 * 담당한다.
 */
export function LivePreview({
  invitationId,
  groomName,
  brideName,
  weddingDate,
  content,
}: Props) {
  return (
    <InvitationSlides
      invitationId={invitationId}
      groomName={groomName}
      brideName={brideName}
      weddingDate={weddingDate}
      content={content}
      // isPreview 로 카운트 기록은 막되, 이 페이지는 발행본을 그대로 확인하는
      // 전체화면 미리보기이므로 배경음악은 실제 화면처럼 들려준다(forceBgm).
      isPreview
      forceBgm
    />
  );
}
