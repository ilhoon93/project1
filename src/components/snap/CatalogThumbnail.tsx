'use client';

import { useState } from 'react';

/**
 * 카탈로그 마스터 샘플 썸네일.
 *
 * 표시는 작은 정적 썸네일(public/wedding-snap/catalog/thumb/{name}.webp)을
 * 우선 사용해 대역폭을 크게 줄인다. 썸네일이 없으면(미생성/신규 카탈로그)
 * 원본 jpg 로, 원본도 없으면 placeholder 박스로 단계적 폴백한다. 생성(fal)
 * 레퍼런스는 원본 경로를 그대로 쓰므로 이 컴포넌트 변경은 표시에만 영향.
 *
 * onError 핸들러가 들어 있어 Server Component 에서 직접 렌더할 수 없다 — 별도
 * client 컴포넌트로 분리해 랜딩(/wedding-snap)·생성 페이지 양쪽에서 동일 폴백.
 */

/** /wedding-snap/catalog/{name}.jpg → /wedding-snap/catalog/thumb/{name}.webp */
function thumbPath(src: string): string | null {
  const m = src.match(
    /^(.*\/wedding-snap\/catalog)\/([^/]+)\.(?:jpe?g|png|webp)$/i,
  );
  return m ? `${m[1]}/thumb/${m[2]}.webp` : null;
}

// 단계: 0 = 썸네일, 1 = 원본, 2 = placeholder.
type Stage = 0 | 1 | 2;

export function CatalogThumbnail({ src, alt }: { src: string; alt: string }) {
  const thumb = thumbPath(src);
  const [stage, setStage] = useState<Stage>(thumb ? 0 : 1);

  const currentSrc = stage === 0 && thumb ? thumb : src;

  return (
    <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-[var(--wd-cream)]">
      {stage !== 2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // key 로 src 가 바뀔 때 img 를 새로 마운트해 onError 재평가 보장.
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          loading="lazy"
          className="block h-full w-full object-contain"
          onError={() => setStage((s) => (s === 0 ? 1 : 2))}
        />
      )}
      {stage === 2 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center text-[10px] text-[var(--wd-mute)]">
          <span className="mb-1">📷</span>
          <span className="font-mono break-all">{src}</span>
          <span className="mt-1 opacity-70">샘플 이미지 추가 필요</span>
        </div>
      )}
    </div>
  );
}
