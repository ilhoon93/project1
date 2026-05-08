/**
 * 혼인서약서 4 모서리에 배치되는 금색 웨딩 장식 코너 SVG.
 *
 * 디자인:
 *   - 곡선형 잎사귀 + 작은 꽃 모티브로 클래식 웨딩 톤
 *   - 금색 그라데이션 (#D4AF37 → #F4E4A6 → #B8941F) 으로 입체감
 *   - 크기는 viewBox 안의 좌상단 배치 — 회전으로 4 모서리 동일 모양 적용
 *
 * 사용:
 *   <OrnamentCorner position="tl" size={48} />  // top-left
 *   <OrnamentCorner position="tr" />            // top-right (수평 반전)
 *   <OrnamentCorner position="bl" />            // bottom-left (수직 반전)
 *   <OrnamentCorner position="br" />            // bottom-right (180° 회전)
 */
export function OrnamentCorner({
  position = 'tl',
  size = 56,
}: {
  position?: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
}) {
  const transform =
    position === 'tr'
      ? 'scale(-1, 1)'
      : position === 'bl'
        ? 'scale(1, -1)'
        : position === 'br'
          ? 'scale(-1, -1)'
          : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`gold-${position}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B8941F" />
          <stop offset="45%" stopColor="#D4AF37" />
          <stop offset="70%" stopColor="#F4E4A6" />
          <stop offset="100%" stopColor="#A6841C" />
        </linearGradient>
      </defs>
      <g
        transform={transform}
        transform-origin="50 50"
        fill="none"
        stroke={`url(#gold-${position})`}
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        {/* 메인 곡선 — L자 형태로 코너를 따라 흐름 */}
        <path d="M 6 50 Q 6 6 50 6" />
        {/* 안쪽 보조 곡선 */}
        <path d="M 14 50 Q 14 14 50 14" strokeWidth="0.8" opacity="0.7" />
        {/* 잎사귀 1 — 위쪽 */}
        <path d="M 30 8 Q 38 4 46 10 Q 38 14 30 8 Z" fill={`url(#gold-${position})`} stroke="none" />
        {/* 잎사귀 2 — 왼쪽 */}
        <path d="M 8 30 Q 4 38 10 46 Q 14 38 8 30 Z" fill={`url(#gold-${position})`} stroke="none" />
        {/* 작은 꽃 — 코너 안쪽 */}
        <circle cx="22" cy="22" r="2.4" fill={`url(#gold-${position})`} stroke="none" />
        <circle cx="22" cy="22" r="0.9" fill="#fff" stroke="none" />
        {/* 작은 점 장식들 — 입체감 */}
        <circle cx="50" cy="11" r="0.9" fill={`url(#gold-${position})`} stroke="none" />
        <circle cx="11" cy="50" r="0.9" fill={`url(#gold-${position})`} stroke="none" />
        {/* 끝부분 작은 잎 */}
        <path d="M 48 6 Q 56 8 60 14" strokeWidth="0.8" opacity="0.85" />
        <path d="M 6 48 Q 8 56 14 60" strokeWidth="0.8" opacity="0.85" />
      </g>
    </svg>
  );
}

/**
 * 가운데 문장(상하단) 작은 장식 — 웨딩 카드 클래식 모티브.
 */
export function OrnamentDivider({ width = 120 }: { width?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 24"
      width={width}
      height={width * 0.12}
      style={{ display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="gold-divider" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8941F" stopOpacity="0" />
          <stop offset="20%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#F4E4A6" />
          <stop offset="80%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#B8941F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="20"
        y1="12"
        x2="84"
        y2="12"
        stroke="url(#gold-divider)"
        strokeWidth="0.8"
      />
      <line
        x1="116"
        y1="12"
        x2="180"
        y2="12"
        stroke="url(#gold-divider)"
        strokeWidth="0.8"
      />
      {/* 가운데 다이아몬드 모티브 */}
      <g transform="translate(100 12)">
        <path
          d="M 0 -7 L 7 0 L 0 7 L -7 0 Z"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="0.8"
        />
        <circle cx="0" cy="0" r="2" fill="#D4AF37" />
      </g>
    </svg>
  );
}
