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
    // 베젤 얇게 + 18:9(= 9:18) 를 "스크린(inner)" 기준으로 정확히 — 실제 스마트폰처럼
    // 베젤은 화면 둘레의 얇은 테두리에 그치고, 안쪽 SCREEN 이 9:18 비율을 가짐.
    <div className="flex h-full max-h-[920px] w-full max-w-[380px] items-center justify-center">
      <div className="relative overflow-hidden rounded-[2rem] border-[3px] border-foreground/85 bg-background shadow-xl">
        <div
          className="relative w-full"
          style={{
            // SCREEN 자체가 9:18. 부모 너비(<=374px) 를 따라가되 가용 세로 높이를
            // 넘지 않도록 width 를 viewport 기반으로 캡.
            width: 'min(374px, calc((100vh - 120px) * 9 / 18))',
            aspectRatio: '9 / 18',
          }}
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
    </div>
  );
}
