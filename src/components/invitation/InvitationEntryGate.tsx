'use client';

import { useState } from 'react';
import { THEME_PALETTES, type ColorTheme } from '@/lib/theme';

interface Props {
  groomName: string;
  brideName: string;
  colorTheme?: ColorTheme;
}

/**
 * 진입 인트로(탭 게이트) — 뷰어에서 처음 뜨는 전체화면 커버.
 *
 * 목적: "탭하여 열기"의 그 탭이 곧 **사용자 제스처**가 되어, 브라우저 자동재생
 * 정책(iOS·카카오톡 인앱 등)에 막히던 배경음악이 입장과 동시에 재생되게 한다.
 * (BgmPlayer 가 window 의 첫 사용자 제스처를 잡아 재생하므로, 이 커버의 탭이
 * 별도 배선 없이 음악을 켠다.)
 *
 * 현재는 관리자 계정이 만든 알림장에만 노출(테스트용).
 */
export function InvitationEntryGate({ groomName, brideName, colorTheme = 'cream' }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const palette = THEME_PALETTES[colorTheme] ?? THEME_PALETTES.cream;
  const names = [groomName?.trim(), brideName?.trim()].filter(Boolean).join('  ·  ');

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => setGone(true), 600);
  };

  return (
    <button
      type="button"
      onClick={enter}
      aria-label="청첩장 열기"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 px-8 text-center transition-opacity duration-500 ease-out"
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <span className="text-[11px] tracking-[0.4em]" style={{ color: palette.accent }}>
        WEDDING INVITATION
      </span>

      {names && (
        <span className="text-2xl font-medium tracking-wide [word-break:keep-all]">{names}</span>
      )}

      <span className="mt-6 flex flex-col items-center gap-2 text-sm opacity-70">
        <span
          aria-hidden
          className="grid h-10 w-10 animate-bounce place-items-center rounded-full border"
          style={{ borderColor: palette.accent, color: palette.accent }}
        >
          ✧
        </span>
        터치하여 청첩장을 열어주세요
      </span>
    </button>
  );
}
