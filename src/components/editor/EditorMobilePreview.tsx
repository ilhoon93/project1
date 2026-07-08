'use client';

import { useEffect, useRef, useState } from 'react';
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
  /** 펼침 상태 — 부모(EditorClient)가 소유해 상단 편집 바 숨김과 동기화한다. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 접힘 상태 핸들 바 높이(px). 펼침 높이는 뷰포트 비율(아래 OPEN_VH).
const BAR_H = 52;
const OPEN_VH = 58;
// 미리보기 영역 안쪽 여백(px) — 미니 폰이 시트 가장자리에 딱 붙지 않도록.
const AREA_PAD = 12;

/**
 * 모바일/태블릿(lg 미만) 전용 실시간 미리보기 — 하단 고정 접이식 시트.
 *
 * 핵심: 실제 뷰포트 크기(window.innerWidth × innerHeight)로 전체화면 미리보기와
 * "완전히 동일하게" 렌더한 stage 를 만든 뒤 `transform: scale()` 로 균일 축소한다.
 * 슬라이드가 쓰는 컨테이너 쿼리 단위(cqw/cqh)는 레이아웃 크기(=축소 전 뷰포트
 * 크기) 기준으로 계산되므로, 글자 크기·화면 비율이 전체화면과 픽셀 단위로 같고
 * 시각적으로만 작아진다. (9:18 같은 고정 비율 박스는 기기 실제 화면비와 달라
 * 요소 비율이 어긋나던 문제를 해결.)
 *
 * lg 이상에서는 좌측 패널(EditorLivePreview)과 중복되므로 숨긴다(lg:hidden).
 */
export function EditorMobilePreview({ invitationId, open, onOpenChange }: Props) {
  const storeId = useEditorStore((s) => s.invitationId);
  const storeContent = useEditorStore((s) => s.content);
  const storeMeta = useEditorStore((s) => s.meta);

  // 실제 모바일 뷰포트 크기 — 전체화면과 동일 렌더의 기준.
  //
  // 주의: 모바일에서 에디터를 스크롤하면 주소창이 접히거나 펴지며 innerHeight 가
  // 바뀐다. 이때마다 stage 화면비(vp.w/vp.h)·배율을 다시 잡으면 미리보기 비율이
  // 출렁인다. 그래서 "너비가 바뀐" 변화(= 실제 방향 전환/리사이즈)일 때만 기준을
  // 갱신하고, 높이만 달라지는 주소창 토글은 무시해 비율을 고정한다.
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const lastWidthRef = useRef(0);
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      if (w === lastWidthRef.current) return; // 높이만 변한 스크롤(주소창) — 무시.
      lastWidthRef.current = w;
      setVp({ w, h: window.innerHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 미리보기 영역(시트 내부 가용 공간) 크기 — 여기에 stage 를 맞춰 축소·중앙정렬.
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!open) return;
    const el = areaRef.current;
    if (!el) return;
    const sync = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // 시트가 가리는 만큼 에디터(=window 스크롤) 하단 여백 확보 → 마지막 입력칸이
  // 시트 뒤에 숨지 않는다. 데스크톱은 lg:hidden 이라 여백 불필요.
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

  // 전체화면(vp) 렌더를 미리보기 영역(area)에 맞게 균일 축소하는 배율.
  const fits = vp.w > 0 && vp.h > 0 && area.w > 0 && area.h > 0;
  const scale = fits
    ? Math.max(
        0,
        Math.min((area.h - AREA_PAD * 2) / vp.h, (area.w - AREA_PAD * 2) / vp.w),
      )
    : 0;
  const stageW = vp.w * scale;
  const stageH = vp.h * scale;
  const left = (area.w - stageW) / 2;
  const top = (area.h - stageH) / 2;

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
          onClick={() => onOpenChange(!open)}
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

        {/* 펼침 영역 — 실제 뷰포트 크기로 렌더한 stage 를 축소해 중앙 배치. */}
        {open && (
          <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-[var(--wd-cream)]">
            {ready && scale > 0 ? (
              <div
                className="absolute overflow-hidden rounded-[1.1rem] bg-background shadow-md ring-1 ring-black/5"
                style={{ left, top, width: stageW, height: stageH }}
              >
                {/* stage: 전체화면과 동일한 px 크기 → 축소 전 레이아웃이 곧 컨테이너 쿼리 기준. */}
                <div
                  style={{
                    width: vp.w,
                    height: vp.h,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <InvitationSlides
                    invitationId={invitationId}
                    groomName={groomName}
                    brideName={brideName}
                    weddingDate={weddingDate}
                    content={content}
                    isPreview
                    scoped
                  />
                </div>
              </div>
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                로딩 중...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
