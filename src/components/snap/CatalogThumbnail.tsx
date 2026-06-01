'use client';

/**
 * 카탈로그 마스터 샘플 썸네일.
 *
 * onError 핸들러가 들어 있어 Server Component 에서 직접 렌더할 수 없다 — 별도
 * client 컴포넌트로 분리해 랜딩 페이지(/wedding-snap) 와 생성 페이지의 카탈로그
 * 그리드(SnapGenerator) 양쪽에서 같은 폴백 동작을 공유한다.
 *
 * 파일이 아직 업로드되지 않았으면(404) placeholder 박스를 보여주고 어떤 경로에
 * 어떤 파일을 두면 되는지 한눈에 식별 가능하게 표시.
 */
export function CatalogThumbnail({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  // 박스: 항상 3:4 비율 + 베이지 배경 + flex center.
  // 이미지: object-contain 으로 가로/세로 비율 유지하며 박스 안에 중앙 정렬.
  //   가로형 마스터 → 위아래 여백,  세로형 → 좌우 여백 (모두 박스 가운데).
  //   별도 `mx-auto my-auto` 없이도 flex center 부모가 처리.
  return (
    <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-[var(--wd-cream)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-contain"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fb = target.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div
        className="absolute inset-0 hidden flex-col items-center justify-center px-2 text-center text-[10px] text-[var(--wd-mute)]"
        style={{ display: 'none' }}
      >
        <span className="mb-1">📷</span>
        <span className="font-mono break-all">{src}</span>
        <span className="mt-1 opacity-70">샘플 이미지 추가 필요</span>
      </div>
    </div>
  );
}
