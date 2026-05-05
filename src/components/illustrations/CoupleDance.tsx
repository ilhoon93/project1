/**
 * 댄스 포즈의 신랑·신부 일러스트.
 *
 * 첨부 이미지의 분위기 (검정 턱시도 신랑이 흰 드레스 신부를 리드하며 추는
 * 슬로우 댄스, 주변에 골드 스파클·하트·점들) 를 단순화한 SVG.
 *
 * - 라인 아트는 currentColor
 * - 신랑 양복은 짙은 fg 채움 + 약한 외곽선
 * - 스파클·하트는 테마 accent (var(--mw-accent))
 */
export function CoupleDance({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 460"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      {/* ── 신부 (살짝 왼쪽, 작고 신랑을 올려다 봄) ── */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 신부 머리 */}
        <ellipse cx="160" cy="170" rx="15" ry="17" />
        {/* 시뇽 (낮은 묶음) */}
        <path d="M148 184 C 142 192, 146 198, 154 198" />
        {/* 베일 — 머리 뒤로 길게 흘러내림 */}
        <path d="M147 178 C 130 220, 125 280, 138 350" strokeWidth="1.1" />
        <path d="M147 178 C 124 230, 120 290, 132 360" strokeWidth="0.9" opacity="0.7" />
        {/* 드레스 — 신랑 쪽으로 살짝 기울며 풍성하게 */}
        <path
          d="M154 188
             L 146 220
             L 138 290
             C 122 340, 130 380, 148 392
             L 184 392
             C 196 380, 198 340, 188 290
             L 178 220
             L 170 188
             Z"
        />
        {/* 신부 팔 — 신랑 어깨에 얹은 왼팔, 오른손은 신랑이 잡음 */}
        <path d="M170 200 Q 195 196, 220 188" strokeWidth="1.3" />
        <path d="M154 210 Q 148 222, 154 240" strokeWidth="1.3" />

        {/* ── 신랑 (오른쪽, 더 큼) ───────────────── */}
        {/* 머리 */}
        <ellipse cx="240" cy="160" rx="14" ry="16" />
        {/* 머리 위 */}
        <path d="M232 153 Q240 146, 248 153" />
      </g>

      {/* 신랑 양복 — 짙은 fill 로 검정 턱시도 표현 */}
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.92"
      >
        {/* 상의 + 라펠 */}
        <path
          d="M226 178
             L 218 200
             L 210 230
             L 212 260
             L 220 300
             L 220 380
             L 232 392
             L 248 392
             L 256 380
             L 256 300
             L 264 260
             L 266 230
             L 258 200
             L 252 178
             L 240 184
             Z"
        />
        {/* 셔츠 V (흰색 빈 공간) */}
        <path d="M236 184 L 240 218 L 244 184 Z" fill="var(--mw-bg, white)" stroke="none" />
        {/* 보타이 */}
        <path
          d="M234 194 L 240 200 L 246 194 L 246 204 L 240 200 L 234 204 Z"
          fill="currentColor"
        />
      </g>

      {/* 신랑 팔, 다리 디테일 */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 신부 등에 얹은 왼팔 */}
        <path d="M222 200 Q 200 220, 178 240" strokeWidth="1.3" />
        {/* 신부 손 잡은 오른팔 (위로 들어올린) */}
        <path d="M256 196 Q 280 178, 290 168" strokeWidth="1.3" />
        {/* 잡은 손 */}
        <circle cx="294" cy="166" r="4" />
        {/* 신랑 다리 라인 (한쪽 살짝 뒤로) */}
        <path d="M232 392 L 224 430 L 220 444" />
        <path d="M252 392 L 264 430 L 270 442" />
        {/* 구두 */}
        <path d="M218 444 Q 214 448, 222 450" strokeWidth="2" />
        <path d="M268 442 Q 274 446, 280 444" strokeWidth="2" />
      </g>

      {/* ── 주변 데코: 스파클 / 하트 / 점들 ────── */}
      <g fill="var(--mw-accent, currentColor)" stroke="none" opacity="0.85">
        {/* 4-pointed stars */}
        {[
          { x: 60, y: 220, s: 7 },
          { x: 80, y: 320, s: 5 },
          { x: 320, y: 220, s: 6 },
          { x: 340, y: 300, s: 7 },
          { x: 100, y: 150, s: 4 },
          { x: 305, y: 130, s: 5 },
        ].map((p, i) => (
          <Sparkle key={i} x={p.x} y={p.y} size={p.s} />
        ))}
        {/* 작은 점 */}
        <circle cx="70" cy="280" r="2" />
        <circle cx="115" cy="380" r="1.6" />
        <circle cx="335" cy="260" r="2" />
        <circle cx="295" cy="380" r="1.6" />
        <circle cx="120" cy="200" r="1.4" />
        <circle cx="285" cy="170" r="1.4" />
        {/* 하트 (작은) */}
        <Heart x={108} y={250} size={6} />
        <Heart x={310} y={245} size={6} />
      </g>
    </svg>
  );
}

function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M0 -${size} L ${size * 0.25} -${size * 0.25} L ${size} 0 L ${size * 0.25} ${size * 0.25} L 0 ${size} L -${size * 0.25} ${size * 0.25} L -${size} 0 L -${size * 0.25} -${size * 0.25} Z`}
      />
    </g>
  );
}

function Heart({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0 ${size * 0.6}
          C -${size * 0.5} 0, -${size} -${size * 0.4}, 0 -${size * 0.2}
          C ${size} -${size * 0.4}, ${size * 0.5} 0, 0 ${size * 0.6} Z`}
    />
  );
}
