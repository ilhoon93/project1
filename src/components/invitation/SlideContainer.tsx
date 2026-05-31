'use client';

import React, { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FallingPetals } from '@/components/shared/FallingPetals';
import { BgmPlayer } from './BgmPlayer';
import {
  FONT_OPTIONS,
  THEME_PALETTES,
  type ColorTheme,
  type FontKey,
  type PetalType,
} from '@/lib/theme';

const SWIPE_THRESHOLD = 50;
const VERTICAL_BIAS = 1.2;

interface Props {
  children: ReactNode[];
  colorTheme?: ColorTheme;
  petalType?: PetalType;
  font?: FontKey;
  bgmUrl?: string | null;
  /**
   * scoped: 컨테이너의 부모 박스 안에서만 동작하도록 viewport 단위(`vw`/`dvh`)
   * 대신 부모 상대 단위(`%`/`h-full`)를 사용한다. 에디터 좌측 미리보기 패널처럼
   * 화면 일부에만 슬라이드를 보여줄 때 사용. 기본 false (= 풀스크린).
   */
  scoped?: boolean;
}

export function SlideContainer({
  children,
  colorTheme = 'cream',
  petalType = 'flower',
  font = 'serif',
  bgmUrl = null,
  scoped = false,
}: Props) {
  const slides = children.filter(Boolean);
  const [index, setIndex] = useState(0);
  const palette = THEME_PALETTES[colorTheme];
  const fontFamily = FONT_OPTIONS[font].family;

  const slidesLen = slides.length;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const commitSwipe = (dx: number, dy: number) => {
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_BIAS) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx < 0) {
      setIndex((i) => Math.min(i + 1, slidesLen - 1));
    } else {
      setIndex((i) => Math.max(i - 1, 0));
    }
  };

  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setIndex((i) => Math.min(i + 1, slidesLen - 1));

  const isInsideNoSwipe = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-noswipe]');

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isInsideNoSwipe(e.target)) {
      startRef.current = null;
      return;
    }
    const t = e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    commitSwipe(t.clientX - start.x, t.clientY - start.y);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInsideNoSwipe(e.target)) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    const onUp = (evt: MouseEvent) => {
      const start = startRef.current;
      startRef.current = null;
      window.removeEventListener('mouseup', onUp);
      if (!start) return;
      commitSwipe(evt.clientX - start.x, evt.clientY - start.y);
    };
    window.addEventListener('mouseup', onUp);
  };

  // CSS variables expose the active palette to nested slides — so they can
  // pick theme-aware colors via `text-[var(--mw-accent)]` etc instead of
  // hard-coding cream-only hexes.
  const themeVars = {
    ['--mw-bg' as string]: palette.bg,
    ['--mw-fg' as string]: palette.fg,
    ['--mw-accent' as string]: palette.accent,
    ['--mw-dot' as string]: palette.dot,
    // 일러스트형 메인 슬라이드의 PNG 라인아트가 다크 테마에서도 잘 보이도록
    // 테마별 CSS filter 체인(크로마키 + 글로우)을 변수로 흘려 보낸다.
    ['--mw-illust-filter' as string]: palette.illustFilter ?? 'none',
    // 단색 라인 스케치(text-flower.png 등) 전용 filter. 다크 테마에서는 invert
    // 로 검은 라인을 흰 라인으로 뒤집어 가독성을 확보한다.
    ['--mw-sketch-filter' as string]: palette.sketchFilter ?? 'none',
  } as React.CSSProperties;

  return (
    <div
      className={`relative overflow-hidden ${
        scoped ? 'h-full w-full' : 'h-[100dvh] w-screen'
      }`}
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        fontFamily,
        ...themeVars,
        // bgPattern은 background-image로 베이스 컬러 위에 얹는다.
        ...(palette.bgPattern
          ? {
              backgroundImage: palette.bgPattern,
              backgroundRepeat: 'repeat',
            }
          : {}),
      }}
    >
      {bgmUrl && !scoped && <BgmPlayer url={bgmUrl} color={palette.accent} />}

      <motion.div
        className="flex h-full"
        animate={{ x: scoped ? `-${index * 100}%` : `-${index * 100}vw` }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          startRef.current = null;
        }}
        onMouseDown={onMouseDown}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`mw-thin-scroll relative h-full flex-shrink-0 touch-pan-y overflow-y-auto ${
              scoped ? 'w-full' : 'w-screen'
            }`}
            // 모든 cqw/cqh 단위가 슬라이드 박스 자체를 기준으로 잡히도록
            // container-type 을 지정. 모바일 풀스크린에서는 슬라이드 = 뷰포트라
            // cqw≈vw 동일하게 동작하고, 데스크톱 미리보기 패널에서는 폰 프레임
            // 박스를 기준이라 폰트 크기·비율이 모바일과 동일하게 보인다.
            style={{ containerType: 'size' }}
          >
            {slide}
            {/* 배경 효과 — 각 슬라이드 박스 안에 z-10 으로 깔아둔다.
                슬라이드 콘텐츠(z-auto) 위에 펠탈/별빛이 떨어지지만, VideoSlide 처럼
                z-20 이상을 설정한 요소(영상 컨테이너)는 효과 위로 올라와 가려짐. */}
            <FallingPetals type={petalType} colors={palette.petals} />
          </div>
        ))}
      </motion.div>

      {/* 하단 점 표시 (인디케이터) */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번 슬라이드로 이동`}
            className="pointer-events-auto h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 20 : 6,
              backgroundColor: i === index ? palette.accent : palette.dot,
            }}
          />
        ))}
      </div>

      {/* 좌우 화살표: 끝 위치에선 disabled:opacity-0 으로 자연스레 사라짐 */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-2 md:px-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          aria-label="이전"
          className="pointer-events-auto grid h-9 w-9 place-items-center bg-transparent text-lg disabled:opacity-0 md:h-10 md:w-10"
          style={{ color: palette.accent, background: 'transparent' }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label="다음"
          className="pointer-events-auto grid h-9 w-9 place-items-center bg-transparent text-lg disabled:opacity-0 md:h-10 md:w-10"
          style={{ color: palette.accent, background: 'transparent' }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
