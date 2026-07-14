'use client';

import { forwardRef } from 'react';
import { THEME_PALETTES, FONT_OPTIONS } from '@/lib/theme';
import { formatWeddingDate } from '@/lib/utils/format-date';
import type { InvitationContent } from '@/types/invitation';
import { MainSlide } from '@/components/invitation/slides/MainSlide';

interface Props {
  content: InvitationContent;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  /** 목표 이미지 픽셀 크기 — 이 박스가 곧 캡처 대상. */
  width: number;
  height: number;
}

/**
 * 알림장 "표지(메인)" 디자인을 이미지 저장용으로 깨끗하게 렌더한다.
 *
 * SlideContainer 를 거치지 않아 하단 점 인디케이터·좌우 화살표·배경음악 버튼이
 * 없고, 내부 `button` (축하하기)도 CSS 로 숨겨 순수 디자인만 남긴다(컨페티는
 * 트리거 전이라 애초에 렌더되지 않음). containerType:size 로 cqw/cqh 단위가 이
 * 박스(=목표 비율) 기준으로 계산돼, 요청한 비율에 맞춰 구성이 재배치된다.
 *
 * 부모가 이 요소(ref)를 html2canvas 로 캡처한다.
 */
export const CoverCapture = forwardRef<HTMLDivElement, Props>(function CoverCapture(
  { content, groomName, brideName, weddingDate, width, height },
  ref,
) {
  const palette = THEME_PALETTES[content.theme.colorTheme];
  const fontFamily = FONT_OPTIONS[content.theme.font].family;
  const formattedDate = weddingDate
    ? formatWeddingDate(weddingDate, content.basic.dateFormat)
    : null;

  const themeVars: Record<string, string> = {
    '--mw-bg': palette.bg,
    '--mw-fg': palette.fg,
    '--mw-accent': palette.accent,
    '--mw-dot': palette.dot,
    '--mw-illust-filter': palette.illustFilter ?? 'none',
    '--mw-sketch-filter': palette.sketchFilter ?? 'none',
  };

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
        containerType: 'size',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: palette.bg,
        color: palette.fg,
        fontFamily,
        ...(themeVars as React.CSSProperties),
        ...(palette.bgPattern
          ? { backgroundImage: palette.bgPattern, backgroundRepeat: 'repeat' }
          : {}),
      }}
    >
      {/* 이미지에 불필요한 UI 크롬 제거 — 축하하기 등 버튼 숨김. */}
      <style>{`.wd-cover-capture button{display:none!important}`}</style>
      <div className="wd-cover-capture absolute inset-0">
        <MainSlide
          invitationId="capture"
          groomName={groomName}
          brideName={brideName}
          weddingDate={formattedDate}
          main={content.main}
          isPreview
        />
      </div>
    </div>
  );
});
