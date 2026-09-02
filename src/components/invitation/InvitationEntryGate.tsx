'use client';

import { useState } from 'react';
import { THEME_PALETTES, type ColorTheme } from '@/lib/theme';

interface Props {
  groomName: string;
  brideName: string;
  /** 표지(메인) 사진 URL. 있으면 배경으로, 없으면 테마 색 배경. */
  heroImage?: string | null;
  colorTheme?: ColorTheme;
}

/**
 * 진입 인트로(탭 게이트) — 뷰어에서 처음 뜨는 전체화면 커버.
 *
 * 왜 필요한가: 카카오톡 인앱은 화면 비율 문제로 외부 브라우저로 자동 전환되는데,
 * 외부 브라우저는 정책상 소리 자동재생을 막는다. 이 커버를 "터치"하는 그 동작이
 * 곧 사용자 제스처가 되어, BgmPlayer 가 window 첫 제스처를 잡아 배경음악을 처음부터
 * 재생한다. 즉 탭 = 입장 + 음악 시작.
 *
 * 연출: 표지 사진을 배경으로 깔고, 하단에 인사말 + "화면을 터치해주세요 ↓". 탭하면
 * 사진이 살짝 확대되며 커버가 페이드아웃되어 알림장 메인이 드러난다.
 */
export function InvitationEntryGate({ groomName, brideName, heroImage, colorTheme = 'cream' }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const palette = THEME_PALETTES[colorTheme] ?? THEME_PALETTES.cream;
  const names = [groomName?.trim(), brideName?.trim()].filter(Boolean).join('  ·  ');
  const hasPhoto = typeof heroImage === 'string' && /^https?:\/\//.test(heroImage);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => setGone(true), 750);
  };

  return (
    <button
      type="button"
      onClick={enter}
      aria-label="청첩장 열기"
      className="fixed inset-0 z-[200] overflow-hidden transition-opacity duration-700 ease-out"
      style={{
        backgroundColor: palette.bg,
        color: hasPhoto ? '#ffffff' : palette.fg,
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* 배경 표지 사진 — 탭 시 살짝 확대. */}
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage as string}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-700 ease-out [-webkit-touch-callout:none]"
            style={{ transform: leaving ? 'scale(1.08)' : 'scale(1)' }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* 텍스트 가독성용 그라데이션. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/60" />
        </>
      )}

      {/* 하단 인사말 + 터치 안내. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-8 pb-24 text-center">
        <span className="text-xs tracking-[0.35em]" style={{ color: hasPhoto ? 'rgba(255,255,255,0.9)' : palette.accent }}>
          WEDDING INVITATION
        </span>
        {names && (
          <span className="text-lg font-medium tracking-wide [word-break:keep-all]">{names}</span>
        )}
        <span className="text-xl font-medium leading-relaxed [word-break:keep-all]">
          우리의 이야기를 시작합니다
        </span>
        <span className="mt-5 flex flex-col items-center gap-1 text-sm opacity-90">
          화면을 터치해주세요
          <span aria-hidden className="animate-bounce text-lg leading-none">
            ↓
          </span>
        </span>
      </div>
    </button>
  );
}
