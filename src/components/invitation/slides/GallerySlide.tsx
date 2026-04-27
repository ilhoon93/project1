'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';

export function GallerySlide({ gallery }: { gallery: InvitationContent['gallery'] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (gallery.images.length === 0) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">갤러리</h2>
        <p className="text-sm text-[#8B7355]">아직 등록된 사진이 없습니다</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-full flex-col gap-6 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">GALLERY</p>
        <h2 className="mt-2 text-xl font-light">우리의 순간들</h2>
      </header>

      <ul className="grid grid-cols-3 gap-1">
        {gallery.images.map((url, i) => (
          <li key={`${url}-${i}`}>
            <button
              type="button"
              onClick={() => setLightbox(i)}
              className="block aspect-square w-full overflow-hidden"
              aria-label={`사진 ${i + 1} 확대`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      {lightbox !== null && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          aria-label="닫기"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gallery.images[lightbox]}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </button>
      )}
    </section>
  );
}
