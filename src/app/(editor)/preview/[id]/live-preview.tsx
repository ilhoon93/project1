'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import {
  InvitationContentSchema,
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
 * Client wrapper around <InvitationSlides>. The server fetches the
 * persisted DB content and passes it as a fallback; once mounted, we
 * swap to the editor's Zustand store *if and only if* the store is
 * holding the same invitation. That way:
 *
 *   - 새 탭/링크로 들어오면 서버 데이터 그대로 보이고,
 *   - 편집 중 미리보기 탭으로 넘어가면 자동저장 디바운스(2초)와 무관하게
 *     항상 직전 입력이 즉시 반영되며,
 *   - 디자인/메인 화면 변경(테마, 색상, 폰트, 페이지 순서, 배경 음악 등)도
 *     딜레이 없이 그 자리에서 갱신된다.
 *
 * The store subscription is reactive — every patchSection() call re-renders
 * the slides. No round-trip to the server, no debounce.
 */
export function LivePreview({
  invitationId,
  groomName,
  brideName,
  weddingDate,
  content,
}: Props) {
  const storeId = useEditorStore((s) => s.invitationId);
  const storeContent = useEditorStore((s) => s.content);
  const storeMeta = useEditorStore((s) => s.meta);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const fromStore = hydrated && storeId === invitationId && storeContent && storeMeta;

  // Reparse store content through the schema in case the persisted shape is
  // out of date with the latest schema (e.g. new fields added since last visit).
  let liveContent: InvitationContent = content;
  let liveGroom = groomName;
  let liveBride = brideName;
  let liveDate = weddingDate;
  if (fromStore) {
    try {
      liveContent = InvitationContentSchema.parse(storeContent);
      liveGroom = storeMeta.groomName;
      liveBride = storeMeta.brideName;
      liveDate = storeMeta.weddingDate;
    } catch {
      // fall back to server data
    }
  }

  return (
    <InvitationSlides
      invitationId={invitationId}
      groomName={liveGroom}
      brideName={liveBride}
      weddingDate={liveDate}
      content={liveContent}
      isPreview
    />
  );
}
