/**
 * 한국 전통 인장(도장) 느낌의 SVG 스탬프.
 *
 * - 빨간 인주색 원형 + 가운데 한글 이름
 * - 한자 인장처럼 조밀하게 채워보이도록 두께 / 자간 조정
 * - 외곽 원: 두꺼운 빨간 테두리
 * - 내부: 흰 배경에 빨간 명조체 글자
 *
 * 이름이 2 글자면 가로로, 3 글자면 세로 2단(姓 + 名 두 글자) 배치.
 * 4 글자 이상이면 작은 폰트로 가로 1줄.
 */
export function NameStamp({
  name,
  size = 96,
}: {
  name: string;
  size?: number;
}) {
  const trimmed = name.trim() || '─';
  const ink = '#B22222'; // 전통 인주색.

  // 글자 배치 결정.
  let lines: string[];
  if (trimmed.length <= 2) {
    lines = [trimmed];
  } else if (trimmed.length === 3) {
    // 성 한 글자 + 이름 두 글자 (전형적 한국 이름).
    lines = [trimmed.slice(0, 1), trimmed.slice(1)];
  } else {
    lines = [trimmed.slice(0, 2), trimmed.slice(2)];
  }

  // 줄별 폰트 크기 — 박스를 가능한 한 꽉 채우도록.
  const fontSize = (() => {
    if (lines.length === 1) {
      return trimmed.length === 1 ? size * 0.55 : size * 0.42;
    }
    // 2 줄 — 줄당 1~2 글자 가정.
    const longest = Math.max(...lines.map((l) => l.length));
    return longest === 1 ? size * 0.42 : size * 0.32;
  })();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
      aria-label={`${name} 인장`}
    >
      {/* 외곽 빨간 원 + 두꺼운 테두리 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - size * 0.04}
        fill="none"
        stroke={ink}
        strokeWidth={size * 0.06}
      />
      {/* 내부 빨간 배경 — 인장 느낌 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - size * 0.1}
        fill={ink}
      />
      {/* 이름 글자 — 흰색 (인주에 새겨진 양각) */}
      <g
        fill="#fff"
        style={{
          fontFamily:
            "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', serif",
          fontWeight: 800,
        }}
      >
        {lines.map((line, i) => {
          const totalH = fontSize * lines.length + (lines.length - 1) * fontSize * 0.05;
          const startY = size / 2 - totalH / 2 + fontSize * 0.85;
          return (
            <text
              key={i}
              x={size / 2}
              y={startY + i * (fontSize * 1.05)}
              fontSize={fontSize}
              textAnchor="middle"
              letterSpacing={fontSize * 0.04}
            >
              {line}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
