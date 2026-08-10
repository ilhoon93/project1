import type { ResolvedSectionHeader } from '@/types/invitation';

/**
 * 슬라이드 상단 중앙의 영문 라벨 + 한글 제목. 각각 표시/숨김 가능하고, 문구는
 * 에디터에서 수정한 값(resolveSectionHeader 로 기본값과 합쳐진 결과)을 받는다.
 * 둘 다 숨김이면 아무것도 렌더하지 않는다.
 */
export function SectionHeader({
  header,
  className,
}: {
  header: ResolvedSectionHeader;
  className?: string;
}) {
  const showEn = header.showEn && !!header.en;
  const showKo = header.showKo && !!header.ko;
  if (!showEn && !showKo) return null;
  return (
    <header className={`text-center ${className ?? ''}`}>
      {showEn && (
        <p className="text-xs tracking-[0.3em] opacity-70">{header.en}</p>
      )}
      {showKo && (
        <h2 className={`${showEn ? 'mt-2 ' : ''}text-xl font-light`}>
          {header.ko}
        </h2>
      )}
    </header>
  );
}
