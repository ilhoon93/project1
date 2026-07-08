'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
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

// 접힘 상태 핸들 바 높이(px). 펼침 높이는 뷰포트 비율(아래 OPEN_VH).
const BAR_H = 52;
const OPEN_VH = 58;

/**
 * 모바일/태블릿(lg 미만) 전용 실시간 미리보기 — 하단 고정 접이식 시트.
 *
 * 데스크톱은 좌측 고정 패널(EditorLivePreview)이 편집 중인 값을 실시간으로
 * 보여준다. 좁은 화면에는 그 공간이 없어, 화면 하단에 항상 붙어 있는 시트를
 * 두고 탭으로 펼치면 미니 미리보기가 나온다. 펼친 채로 위쪽 편집 폼을 수정하면
 * Zustand 스토어를 직접 구독하는 이 미리보기가 즉시 갱신된다 — /preview 페이지나
 * 전체화면 오버레이처럼 편집 화면을 떠나거나 가리지 않고 "보면서 편집"이 된다.
 *
 * lg 이상에서는 좌측 패널과 중복되므로 숨긴다(lg:hidden).
 */
export function EditorMobilePreview({ invitationId }: Props) {
  const [open, setOpen] = useState(false);

  const storeId = useEditorStore((s) => s.invitationId);
  const storeContent = useEditorStore((s) => s.content);
  const storeMeta = useEditorStore((s) => s.meta);

  // 시트가 가리는 만큼 에디터(=window 스크롤) 하단에 여백을 확보 → 마지막 입력칸이
  // 시트 뒤에 숨지 않는다. 데스크톱은 이 컴포넌트가 시각적으로 숨겨지므로(lg:hidden)
  // 여백을 넣지 않는다.
  useEffect(() => {
    const apply = () => {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      document.body.style.paddingBottom = isDesktop
        ? ''
        : open
          ? `${OPEN_VH}vh`
          : `${BAR_H}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      document.body.style.paddingBottom = '';
    };
  }, [open]);

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
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div
        className={`flex w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[var(--wd-line)] bg-[var(--wd-paper)] shadow-[0_-8px_30px_rgba(31,27,23,0.16)] transition-[height] duration-300 ease-out ${
          open ? 'h-[58vh]' : 'h-[52px]'
        }`}
      >
        {/* 핸들 바 — 탭해서 펼치기/접기 */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? '미리보기 접기' : '미리보기 펼치기'}
          className="flex shrink-0 items-center justify-between gap-2 px-4"
          style={{ height: BAR_H }}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--wd-ink)]">
            <Eye size={15} />
            실시간 미리보기
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--wd-mute)]">
            {open ? '접기' : '펼쳐서 보며 편집'}
            {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </span>
        </button>

        {/* 펼침 영역 — 남는 높이를 미니 폰 미리보기가 채운다. scoped 로 이 박스 안에서만 렌더. */}
        {open && (
          <div className="relative min-h-0 flex-1 bg-[var(--wd-cream)] p-3">
            <div className="flex h-full w-full items-center justify-center">
              <div
                className="relative h-full max-w-full overflow-hidden rounded-[1.25rem] border-[3px] border-foreground/80 bg-background shadow-md"
                style={{ aspectRatio: '9 / 18' }}
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
        )}
      </div>
    </div>
  );
}
