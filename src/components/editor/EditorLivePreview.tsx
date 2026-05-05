'use client';

import { useEditorStore } from '@/stores/editor';
import {
  InvitationContentSchema,
  defaultInvitationContent,
  type InvitationContent,
} from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';

interface Props {
  invitationId: string;
}

/**
 * 데스크톱 에디터의 좌측 실시간 미리보기 패널.
 *
 * Zustand 스토어를 직접 구독하므로 우측 컨트롤에서 값을 바꿀 때마다 즉시
 * 반영된다 — 자동 저장이나 서버 라운드트립 없이도 진짜 "실시간"이다.
 * 모바일/태블릿에서는 부모 레이아웃이 hidden 처리하므로 자체 미디어 쿼리는
 * 필요 없다.
 */
export function EditorLivePreview({ invitationId }: Props) {
  const storeId = useEditorStore((s) => s.invitationId);
  const storeContent = useEditorStore((s) => s.content);
  const storeMeta = useEditorStore((s) => s.meta);

  // 첫 hydration 직전이면 빈 placeholder. 빨리 init() 이 호출되므로 한 프레임만.
  const ready = storeId === invitationId && storeContent && storeMeta;

  let content: InvitationContent = defaultInvitationContent();
  let groomName = '';
  let brideName = '';
  let weddingDate: string | null = null;
  if (ready) {
    try {
      content = InvitationContentSchema.parse(storeContent);
      groomName = storeMeta.groomName;
      brideName = storeMeta.brideName;
      weddingDate = storeMeta.weddingDate;
    } catch {
      // 스키마가 갱신됐는데 store 가 옛 형태면 기본값으로 폴백.
    }
  }

  return (
    <div className="flex h-full max-h-[800px] w-full max-w-[380px] flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>실시간 미리보기</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
          Live
        </span>
      </div>
      {/* 모바일 프레임 — 9:19 비율의 폰 외관 */}
      <div
        className="relative mx-auto flex w-full overflow-hidden rounded-[2.25rem] border-[10px] border-foreground/85 bg-background shadow-xl"
        style={{ aspectRatio: '9 / 19', maxHeight: '100%' }}
      >
        {ready ? (
          <InvitationSlides
            invitationId={invitationId}
            groomName={groomName}
            brideName={brideName}
            weddingDate={weddingDate}
            content={content}
            isPreview
            scoped
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
            로딩 중...
          </div>
        )}
      </div>
    </div>
  );
}
