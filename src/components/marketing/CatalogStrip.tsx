'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AiSnapItem } from '@/lib/marketing/sample-invitations';

/**
 * AI 스냅 카탈로그 가로 스트립 + 하단 드래그 슬라이드바.
 *
 * 데스크톱 마우스 사용자도 스트립을 넘길 수 있도록 아래에 커스텀 스크롤바를 둔다.
 * (네이티브 스크롤바는 숨겨져 있어 마우스로 끌 수 없었음.)
 *  - 트랙을 클릭/드래그하면 thumb 가 따라오고 스트립 scrollLeft 가 동기화.
 *  - 스트립을 트랙패드/터치로 스크롤하면 thumb 위치가 역으로 갱신.
 */
export function CatalogStrip({
  catalogCount,
  aiSnaps,
}: {
  catalogCount: number;
  aiSnaps: AiSnapItem[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [thumb, setThumb] = useState({ width: 30, left: 0 }); // % 단위

  // 스트립 스크롤 → thumb 위치/크기 동기화.
  const syncFromStrip = () => {
    const el = stripRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth) {
      setThumb({ width: 100, left: 0 });
      return;
    }
    const widthPct = (clientWidth / scrollWidth) * 100;
    const leftPct = (scrollLeft / scrollWidth) * 100;
    setThumb({ width: widthPct, left: leftPct });
  };

  useEffect(() => {
    syncFromStrip();
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncFromStrip, { passive: true });
    window.addEventListener('resize', syncFromStrip);
    return () => {
      el.removeEventListener('scroll', syncFromStrip);
      window.removeEventListener('resize', syncFromStrip);
    };
  }, []);

  // 트랙 좌표 → 스트립 scrollLeft.
  const scrollToClientX = (clientX: number) => {
    const track = trackRef.current;
    const strip = stripRef.current;
    if (!track || !strip) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    // thumb 중앙이 커서를 따라오도록 thumb 폭의 절반 보정.
    const thumbW = strip.clientWidth / strip.scrollWidth;
    const adjusted = Math.max(0, Math.min(1, ratio - thumbW / 2)) / (1 - thumbW || 1);
    strip.scrollLeft = Math.max(0, Math.min(1, adjusted)) * maxScroll;
  };

  return (
    <div className="mt-6">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-[var(--wd-ink)]">
          이런 스타일까지, 골라서 우리 얼굴로
        </span>
        <span className="text-[11px] text-[var(--wd-mute)]">전체 {catalogCount}종 중 일부</span>
      </div>

      <div
        id="catalog-strip"
        ref={stripRef}
        className="flex gap-2.5 overflow-x-auto pb-1 [-webkit-mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)] [&::-webkit-scrollbar]:hidden"
      >
        {aiSnaps.map((t) => (
          <Link
            key={t.id}
            href="/wedding-snap"
            className="group relative block aspect-[3/4] w-[118px] flex-shrink-0 overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[#EFE6DC]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.src}
              alt={`${t.label} AI 웨딩스냅 예시`}
              loading="lazy"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            <span className="absolute inset-x-2 bottom-1.5 text-[10.5px] font-medium leading-tight text-white">
              {t.label}
            </span>
          </Link>
        ))}
      </div>

      {/* 하단 드래그 슬라이드바 — hover 없이도 트랙/thumb 가 또렷이 보이도록
          track 콘트라스트(ink/15), thumb 풀 코랄 + 살짝 더 두꺼운 두께(3px → 3.5px). */}
      <div
        ref={trackRef}
        role="scrollbar"
        aria-controls="catalog-strip"
        aria-orientation="horizontal"
        aria-label="카탈로그 가로 스크롤"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          thumb.width >= 100
            ? 0
            : Math.round((thumb.left / (100 - thumb.width)) * 100)
        }
        className="relative mt-3 h-3 cursor-pointer touch-none select-none rounded-full bg-[var(--wd-ink)]/15 ring-1 ring-inset ring-[var(--wd-ink)]/5"
        onPointerDown={(e) => {
          draggingRef.current = true;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // setPointerCapture 미지원 — 무시
          }
          scrollToClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) scrollToClientX(e.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--wd-coral)] shadow-sm transition-[background-color] hover:brightness-95"
          style={{ width: `${thumb.width}%`, left: `${thumb.left}%` }}
        />
      </div>
    </div>
  );
}
