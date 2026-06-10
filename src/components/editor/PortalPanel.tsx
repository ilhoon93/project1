'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * 앵커(트리거) 요소 바로 아래(공간 부족 시 위)로 fixed 배치되는 드롭다운 패널.
 *
 * body 로 portal 하므로 SectionEditor 등 부모의 `overflow-hidden` 에 클리핑되지
 * 않는다 — 콤보박스 옵션이 길어 섹션 하단에서 잘리던 문제를 구조적으로 방지하고,
 * 이후 옵션이 더 추가돼도 안전하다.
 *
 * 외부 클릭 / ESC / 스크롤·리사이즈 추적까지 처리한다. 콤보박스는 트리거에 ref 를
 * 달고 다음처럼 감싸기만 하면 된다:
 *
 *   const anchorRef = useRef<HTMLButtonElement>(null);
 *   const [open, setOpen] = useState(false);
 *   <button ref={anchorRef} onClick={() => setOpen(v => !v)}>…</button>
 *   <PortalPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)}>
 *     <ul role="listbox">…</ul>
 *   </PortalPanel>
 */
export function PortalPanel({
  anchorRef,
  open,
  onClose,
  className = 'overflow-hidden rounded-md border border-input bg-background shadow-lg',
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** 패널 컨테이너 시각 클래스 (테두리/배경/그림자/모서리 등). */
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  // onClose 최신값 유지 — effect deps 를 [open] 으로 안정화.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  // 위치 계산 — 아래 공간이 부족하면 위로 flip + maxHeight 내부 스크롤.
  useLayoutEffect(() => {
    if (!open) return;
    const recalc = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const GAP = 4;
      const PADDING = 8;
      const spaceBelow = window.innerHeight - r.bottom - GAP - PADDING;
      const spaceAbove = r.top - GAP - PADDING;
      const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        160,
        Math.min(384, placeAbove ? spaceAbove : spaceBelow),
      );
      const top = placeAbove ? r.top - GAP - maxHeight : r.bottom + GAP;
      let left = r.left;
      if (left + r.width > window.innerWidth - PADDING) {
        left = window.innerWidth - PADDING - r.width;
      }
      if (left < PADDING) left = PADDING;
      setPos({ top, left, width: r.width, maxHeight });
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open, anchorRef]);

  // 외부 클릭 / ESC 로 닫기 — 패널은 앵커 밖(portal)이라 둘 다 예외 처리.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target instanceof Node ? e.target : null;
      if (t && anchorRef.current?.contains(t)) return;
      if (t && panelRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchorRef]);

  if (!mounted || !open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="presentation"
      className={className}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        overflowY: 'auto',
        zIndex: 200,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
