/**
 * 데스크톱 사이드 마지널리아 — 단색 cream 의 양옆 빈 공간을 채우는 장식.
 * lg breakpoint 이상에서만 보임. 모바일/태블릿에서는 hidden.
 *
 * - SideCaption : 세로 italiana 캡션 (writing-mode vertical-rl)
 * - SideSprig   : 가는 stroke 의 보태니컬 라인아트 SVG
 *
 * 두 컴포넌트 모두 absolute 라 부모 섹션이 `relative` 여야 한다.
 */

export function SideCaption({
  text,
  side,
  topPct = 50,
}: {
  text: string;
  side: 'left' | 'right';
  topPct?: number;
}) {
  const pos = side === 'left' ? 'lg:left-4 xl:left-8' : 'lg:right-4 xl:right-8';
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute hidden font-italiana text-[10px] font-medium tracking-[0.36em] text-[var(--wd-coral)]/55 lg:block ${pos}`}
      style={{
        top: `${topPct}%`,
        writingMode: 'vertical-rl',
        transform: 'translateY(-50%)',
      }}
    >
      {text}
    </span>
  );
}

export function SideSprig({
  side,
  topPct = 50,
  height = 200,
}: {
  side: 'left' | 'right';
  topPct?: number;
  height?: number;
}) {
  const pos =
    side === 'left' ? 'lg:left-12 xl:left-16' : 'lg:right-12 xl:right-16';
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute hidden lg:block ${pos}`}
      style={{
        top: `${topPct}%`,
        transform:
          side === 'left' ? 'translateY(-50%)' : 'translateY(-50%) scaleX(-1)',
      }}
      width="72"
      height={height}
      viewBox="0 0 72 200"
      fill="none"
      stroke="var(--wd-coral)"
      strokeOpacity="0.45"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M36 6 C 36 60, 33 120, 36 196" />
      <path d="M36 28 q -16 -6 -26 -2" />
      <path d="M28 28 q -2 -10 6 -16" />
      <path d="M36 64 q 16 -4 24 0" />
      <path d="M52 60 q 6 -8 0 -16" />
      <path d="M36 100 q -16 -4 -22 4" />
      <path d="M22 96 q -2 -10 6 -16" />
      <path d="M36 138 q 12 -2 20 6" />
      <path d="M52 138 q 6 -10 0 -18" />
      <path d="M36 170 q -14 0 -20 8" />
    </svg>
  );
}
