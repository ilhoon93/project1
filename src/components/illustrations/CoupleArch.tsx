/**
 * 꽃 아치 아래 손 잡고 걷는 신랑·신부 일러스트.
 *
 * 라인 아트는 currentColor 로 그려져 부모의 `color` (= 테마 fg) 를 따라가고,
 * 잎·꽃 같은 작은 컬러 포인트는 테마 accent 를 사용한다 (CSS 변수).
 *
 * 첨부 이미지의 분위기 (벚꽃·아이비 아치, 측면 코스모스, 손잡고 걷는 커플)
 * 를 단순화한 형태로 옮겼다 — 픽셀 사진을 그대로 임베드하면 다크 테마에서
 * 어색해지므로 SVG 로 다시 그려 색에 자연스럽게 적응시킨다.
 */
export function CoupleArch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 460"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ── 상단 아치 (덩굴 + 잎) ───────────────── */}
        <path
          d="M70 200 C 90 130, 160 90, 200 86 C 240 90, 310 130, 330 200"
          strokeWidth="1.6"
        />
        {/* 아치에 붙은 잎들 */}
        {ARCH_LEAVES.map((leaf, i) => (
          <Leaf key={i} {...leaf} />
        ))}
        {/* 아치 위 작은 장미 / 꽃 점들 */}
        {ARCH_BLOOMS.map((b, i) => (
          <Bloom key={i} cx={b.cx} cy={b.cy} r={b.r} accent={b.accent} />
        ))}

        {/* ── 좌측 코스모스 / 데이지 식물 ─────────── */}
        <SidePlants side="left" />

        {/* ── 우측 코스모스 / 데이지 식물 ─────────── */}
        <SidePlants side="right" />

        {/* ── 신부 (왼쪽) ─────────────────────────── */}
        {/* 머리 */}
        <ellipse cx="170" cy="175" rx="16" ry="18" />
        {/* 머리 묶음(낮은 시뇽) */}
        <path d="M154 188 C 150 196, 154 204, 162 204" />
        {/* 베일 */}
        <path d="M155 178 C 140 200, 138 250, 152 320" strokeWidth="1.1" />
        {/* 드레스 — 어깨에서 발끝까지 A라인 */}
        <path d="M162 198 L 156 240 L 152 320 L 178 380 L 196 240 L 188 198 Z" />
        {/* 부케 */}
        <circle cx="156" cy="298" r="11" />
        <path d="M156 308 L 154 326" />
        <path d="M152 296 L 148 290 M160 296 L 164 290 M156 290 L 156 286" />

        {/* ── 신랑 (오른쪽) ───────────────────────── */}
        {/* 머리 */}
        <ellipse cx="240" cy="175" rx="14" ry="16" />
        {/* 머리 위 살짝 표시 */}
        <path d="M232 168 Q240 161, 248 168" />
        {/* 어깨 + 양복 라인 */}
        <path d="M226 198 L 220 248 L 218 332 L 232 380 L 248 332 L 250 248 L 244 198 Z" />
        {/* 셔츠 V */}
        <path d="M232 200 L 235 218 L 238 200" />
        {/* 부토니에르 */}
        <circle cx="231" cy="214" r="2" fill="var(--mw-accent, currentColor)" stroke="none" />

        {/* ── 잡은 손 ─────────────────────────────── */}
        <path d="M200 252 Q204 248, 208 252" strokeWidth="1.2" />

        {/* ── 발끝 ─────────────────────────────────── */}
        <path d="M168 384 Q172 388, 178 386" />
        <path d="M226 384 Q232 388, 238 386" />
      </g>
    </svg>
  );
}

// ── 헬퍼 ───────────────────────────────────────────────────

interface LeafProps {
  cx: number;
  cy: number;
  rotate: number;
  size?: number;
  fill?: boolean;
}

function Leaf({ cx, cy, rotate, size = 12, fill }: LeafProps) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
      <path
        d={`M0 0 Q ${size * 0.5} -${size * 0.5}, 0 -${size} Q -${size * 0.5} -${size * 0.5}, 0 0 Z`}
        fill={fill ? 'var(--mw-accent, currentColor)' : 'none'}
        opacity={fill ? 0.4 : 1}
      />
      <path d={`M0 0 L 0 -${size}`} strokeWidth="0.8" />
    </g>
  );
}

function Bloom({
  cx,
  cy,
  r,
  accent,
}: {
  cx: number;
  cy: number;
  r: number;
  accent?: boolean;
}) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle
        cx="0"
        cy="0"
        r={r}
        fill={accent ? 'var(--mw-accent, currentColor)' : 'none'}
        opacity={accent ? 0.55 : 1}
      />
      {/* 꽃잎 5장 */}
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          key={a}
          d={`M0 0 Q 0 -${r * 1.4}, 0 -${r * 1.7}`}
          transform={`rotate(${a})`}
          strokeWidth="0.7"
          opacity="0.7"
        />
      ))}
    </g>
  );
}

function SidePlants({ side }: { side: 'left' | 'right' }) {
  const baseX = side === 'left' ? 60 : 340;
  const dir = side === 'left' ? 1 : -1;
  return (
    <g>
      {/* 줄기 */}
      <path d={`M${baseX} 410 Q ${baseX + 8 * dir} 320, ${baseX - 4 * dir} 220`} />
      <path d={`M${baseX - 18 * dir} 405 Q ${baseX - 6 * dir} 340, ${baseX + 12 * dir} 250`} />
      {/* 잎 */}
      <Leaf cx={baseX + 4 * dir} cy={350} rotate={side === 'left' ? -25 : 25} size={14} />
      <Leaf cx={baseX - 10 * dir} cy={380} rotate={side === 'left' ? 35 : -35} size={12} />
      <Leaf cx={baseX + 10 * dir} cy={290} rotate={side === 'left' ? -15 : 15} size={13} />
      {/* 꽃 — 데이지 / 코스모스 */}
      <Bloom cx={baseX + 16 * dir} cy={250} r={8} />
      <Bloom cx={baseX - 22 * dir} cy={310} r={6} accent />
      <Bloom cx={baseX - 14 * dir} cy={245} r={5} />
      <Bloom cx={baseX + 4 * dir} cy={210} r={7} accent />
    </g>
  );
}

// 아치 잎 위치 — 좌우 대칭에 가까운 자연스러운 분포
const ARCH_LEAVES: LeafProps[] = [
  { cx: 90, cy: 180, rotate: -60, size: 14 },
  { cx: 110, cy: 150, rotate: -50, size: 12 },
  { cx: 140, cy: 120, rotate: -30, size: 14 },
  { cx: 175, cy: 100, rotate: -10, size: 13 },
  { cx: 200, cy: 92, rotate: 0, size: 14 },
  { cx: 225, cy: 100, rotate: 10, size: 13 },
  { cx: 260, cy: 120, rotate: 30, size: 14 },
  { cx: 290, cy: 150, rotate: 50, size: 12 },
  { cx: 310, cy: 180, rotate: 60, size: 14 },
];

const ARCH_BLOOMS: { cx: number; cy: number; r: number; accent?: boolean }[] = [
  { cx: 125, cy: 135, r: 7, accent: true },
  { cx: 160, cy: 110, r: 6 },
  { cx: 200, cy: 100, r: 5 },
  { cx: 240, cy: 110, r: 6 },
  { cx: 275, cy: 135, r: 7, accent: true },
];
