'use client';

import { useEffect, useRef, useState } from 'react';
import type { BeforeAfterConfig } from '@/lib/marketing/sample-invitations';

/**
 * AI 웨딩스냅 Before/After 슬라이더 + 스타일 탭.
 *
 * 최초 마운트 시 1.5 초 후 슬라이더 핸들이 좌우로 70 회 움직여 "드래그 가능"
 * 어포던스를 알려준다. 사용자가 직접 드래그하면 즉시 데모 중단.
 *
 * before 사진 + 스타일 목록(label/afterLabel/afterImage)은 운영자가
 * /admin/home-samples 에서 편집한 BeforeAfterConfig 를 props 로 받아 렌더.
 */
export function BeforeAfterSlider({ config }: { config: BeforeAfterConfig }) {
  const styles = config.styles;
  const [styleId, setStyleId] = useState<string>(styles[0]?.id ?? '');
  const [pct, setPct] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const userPickedRef = useRef(false);

  useEffect(() => {
    if (userPickedRef.current) return;
    let p = 50;
    let dir = -1;
    let steps = 0;
    const start = setTimeout(() => {
      const i = setInterval(() => {
        if (userPickedRef.current) {
          clearInterval(i);
          return;
        }
        p += dir * 1.8;
        if (p <= 22) dir = 1;
        if (p >= 78) dir = -1;
        steps++;
        setPct(p);
        if (steps > 70) {
          clearInterval(i);
          setPct(50);
        }
      }, 45);
    }, 1500);
    return () => clearTimeout(start);
  }, []);

  function applyClientX(clientX: number) {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPct(next);
  }

  const active = styles.find((s) => s.id === styleId) ?? styles[0];
  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--wd-line)] bg-white">
      <div
        ref={sliderRef}
        className="relative aspect-[3/2] max-h-[380px] w-full cursor-ew-resize touch-none select-none overflow-hidden"
        onPointerDown={(e) => {
          draggingRef.current = true;
          userPickedRef.current = true;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // setPointerCapture 미지원 환경 — 무시
          }
          applyClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) applyClientX(e.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <div className="absolute inset-0 bg-[#EFE6DC]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.beforeImage}
            alt="평소 커플 사진 (변환 전)"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>
        <div
          className="absolute inset-0 bg-[#EFE6DC]"
          style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.afterImage}
            alt={`${active.label} AI 웨딩스냅 결과`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="absolute left-3.5 top-3.5 rounded-full bg-black/55 px-3 py-1.5 text-[10.5px] font-medium tracking-wider text-white">
          BEFORE
        </div>
        <div className="absolute right-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1.5 text-[10.5px] font-medium tracking-wider text-[var(--wd-ink)]">
          {active.afterLabel}
        </div>
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-[3] w-[2px] -translate-x-1/2 bg-white/95"
          style={{ left: `${pct}%` }}
        >
          <div className="absolute left-1/2 top-1/2 grid h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--wd-ink)] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path
                d="M4 7L1 4M1 4l3-3M1 4h16M14 7l3 3m0 0l-3 3m3-3H1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-[var(--wd-line)] p-4 [&::-webkit-scrollbar]:hidden">
        {styles.map((s) => {
          const on = s.id === active.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                userPickedRef.current = true;
                setStyleId(s.id);
                setPct(50);
              }}
              className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[12px] transition-colors ${
                on
                  ? 'border-[var(--wd-ink)] bg-[var(--wd-ink)] text-[var(--wd-cream)]'
                  : 'border-[var(--wd-line)] bg-transparent text-[var(--wd-mute)] hover:border-[var(--wd-ink)]/30'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
