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
  return (
    <div className="grid aspect-[3/4] w-full place-items-center bg-[#F5EDE0]">
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
        className="hidden h-full w-full flex-col items-center justify-center px-2 text-center text-[10px] text-[#8B7355]"
        style={{ display: 'none' }}
      >
        <span className="mb-1">📷</span>
        <span className="font-mono">{src}</span>
        <span className="mt-1 opacity-70">샘플 이미지 추가 필요</span>
      </div>
    </div>
  );
}
