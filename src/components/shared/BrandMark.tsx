/**
 * 우리다운 브랜드 마크 — 두 꽃잎(petal) 이 겹쳐 만나는 모양으로
 * "두 사람이 서로 기대어 만나는 결합" 을 표현한다.
 *
 * 마케팅 영역 전용 — 헤더/푸터/Hero 브랜드 라인/구분선 스탬프 등에
 * 일관 사용한다. 색은 INK + CORAL 토큰(globals.css) 을 따른다.
 */
export function BrandMark({
  size = 24,
  className = '',
  ariaLabel = '우리다운',
}: {
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const height = Math.round((size * 70) / 100);
  return (
    <svg
      viewBox="0 0 100 70"
      width={size}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <ellipse
        cx="38"
        cy="35"
        rx="17"
        ry="26"
        transform="rotate(-15 38 35)"
        fill="var(--wd-ink)"
      />
      <ellipse
        cx="62"
        cy="35"
        rx="17"
        ry="26"
        transform="rotate(15 62 35)"
        fill="var(--wd-coral)"
        opacity="0.92"
      />
    </svg>
  );
}
