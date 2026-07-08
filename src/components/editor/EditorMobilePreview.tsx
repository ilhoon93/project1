'use client';

import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
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
 * 모바일/태블릿(lg 미만) 전용 실시간 미리보기.
 *
 * 데스크톱은 좌측 고정 패널(EditorLivePreview)이 편집 중인 값을 실시간으로
 * 보여주지만, 좁은 화면에는 그 공간이 없다. 그래서 우하단 플로팅 버튼을 눌러
 * 전체화면 오버레이로 같은 실시간 미리보기를 띄운다 — /preview 페이지(저장본만
 * 반영)와 달리 Zustand 스토어를 직접 구독하므로 저장 전 변경분도 즉시 보인다.
 *
 * lg 이상에서는 좌측 패널과 중복되므로 숨긴다(lg:hidden).
 */
export function EditorMobilePreview({ invitationId }: Props) {
  const [open, setOpen] = useState(false);

  const storeId = useEditorStore((s) => s.invitationId);
  const storeContent = useEditorStore((s) => s.content);
  const storeMeta = useEditorStore((s) => s.meta);

  // 오버레이가 열려 있는 동안 배경(에디터) 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape 로 닫기.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
    <>
      {/* 플로팅 버튼 — 우하단 고정, lg 미만 only. 오버레이가 열리면 숨긴다. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="실시간 미리보기 열기"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-4 py-3 text-[13px] font-medium text-[var(--wd-cream)] shadow-lg transition-transform active:scale-[0.97] lg:hidden"
        >
          <Eye size={16} />
          미리보기
        </button>
      )}

      {/* 전체화면 오버레이 — 편집 중인 값을 실시간 반영. */}
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black lg:hidden">
          <div className="flex items-center justify-between gap-2 bg-black/80 px-4 py-2 text-white backdrop-blur">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
              <Eye size={14} />
              실시간 미리보기
              <span className="text-white/50">· 편집 내용 즉시 반영</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="미리보기 닫기"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/25"
            >
              <X size={14} />
              닫기
            </button>
          </div>

          {/* 남는 영역을 알림장이 가득 채우도록 — scoped 로 이 박스 안에서만 렌더. */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
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
      )}
    </>
  );
}
