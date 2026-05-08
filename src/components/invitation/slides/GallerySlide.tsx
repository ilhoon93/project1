'use client';

import { useEffect, useRef, useState } from 'react';
import type { InvitationContent } from '@/types/invitation';

export function GallerySlide({ gallery }: { gallery: InvitationContent['gallery'] }) {
  if (gallery.images.length === 0) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">갤러리</h2>
        <p className="text-sm opacity-70">아직 등록된 사진이 없습니다</p>
      </section>
    );
  }

  const layout = gallery.layout ?? 'grid';

  return (
    <section className="flex min-h-full flex-col gap-6 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">GALLERY</p>
        <h2 className="mt-2 text-xl font-light">우리의 순간들</h2>
      </header>

      {layout === 'grid' ? (
        <GalleryGrid images={gallery.images} />
      ) : (
        <GallerySlider images={gallery.images} />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 슬라이드형 — 중앙 큰 사진 + 하단 썸네일 5장. 메인 사진 좌우 스와이프 시
// 썸네일도 같이 따라 움직이고, 썸네일을 누르면 메인이 해당 인덱스로 점프.
// ─────────────────────────────────────────────────────────────

function GallerySlider({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // 메인 사진에서 가벼운 탭(짧은 거리)일 땐 setIndex 호출하지 않고 라이트박스 호출.
  const movedRef = useRef(false);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 30;

  const last = images.length - 1;
  const clamped = Math.max(0, Math.min(images.length - 1, index));

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    movedRef.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8) {
      movedRef.current = true;
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0 && index > 0) setIndex(index - 1);
    if (dx < 0 && index < last) setIndex(index + 1);
  };

  // 썸네일이 활성 인덱스를 자동으로 가운데로 가져오도록 스크롤 동기화.
  // scrollIntoView 는 모든 ancestor 스크롤 컨테이너를 함께 움직여 슬라이드 컨테이너의
  // transform 위치를 흔드는 부작용이 있어, scrollLeft 를 직접 계산해 strip 만 움직인다.
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`[data-thumb-index="${clamped}"]`);
    if (!el) return;
    const stripRect = strip.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const desiredCenter = stripRect.left + strip.clientWidth / 2;
    const elCenter = elRect.left + el.offsetWidth / 2;
    const offset = elCenter - desiredCenter;
    if (Math.abs(offset) < 1) return;
    strip.scrollTo({ left: strip.scrollLeft + offset, behavior: 'smooth' });
  }, [clamped]);

  return (
    // data-noswipe — SlideContainer 의 슬라이드 전환 스와이프와 분리. 갤러리 안 좌우 스와이프
    // 는 메인 사진 자체에서만 동작하고 슬라이드 전환에는 영향 주지 않도록 한다.
    <div data-noswipe className="flex flex-col gap-3">
      {/* 중앙 큰 사진 — 좌우 스와이프 가능. 단순 탭은 라이트박스 오픈.
          z-20 으로 슬라이드의 z-10 배경 효과(별빛/펠탈) 위로 올려 사진 위에는 효과가 떨어지지 않게. */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative z-20"
      >
        <button
          type="button"
          onClick={() => {
            if (!movedRef.current) setLightbox(true);
          }}
          aria-label={`사진 ${clamped + 1} / ${images.length} 확대`}
          className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[clamped]}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {clamped + 1} / {images.length}
          </span>
        </button>
      </div>

      {/* 하단 썸네일 스트립 — 가로 스크롤. 한 화면에 약 5장 보이도록 너비 조정. */}
      <div
        ref={thumbStripRef}
        className="-mx-2 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {images.map((url, i) => {
          const active = i === clamped;
          return (
            <button
              key={`${url}-${i}`}
              type="button"
              data-thumb-index={i}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 사진으로`}
              className={`relative aspect-square shrink-0 snap-center overflow-hidden rounded transition-all ${
                active
                  ? 'ring-1 ring-[var(--mw-accent)] ring-offset-1 ring-offset-transparent'
                  : 'opacity-60 hover:opacity-100'
              }`}
              style={{ width: 'calc((100% - 4 * 0.375rem) / 5)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>

      {lightbox && (
        <Lightbox src={images[clamped]} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 그리드형 — 상단에 선택 사진 크게 + 하단에 그리드. 사진 클릭 시 상단 사진 교체.
// 첫 진입엔 첫 사진을 자동 선택해 큰 미리보기를 보여 준다.
// ─────────────────────────────────────────────────────────────

function GalleryGrid({ images }: { images: string[] }) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* 상단 큰 사진 — z-20 으로 배경 효과 위로 올려 사진 위에 효과가 떨어지지 않게. */}
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label="선택된 사진 확대"
        className="relative z-20 aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[selected]}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
          {selected + 1} / {images.length}
        </span>
      </button>

      {/* 하단 그리드 — 클릭 시 상단 사진 교체. */}
      <ul className="grid grid-cols-3 gap-1">
        {images.map((url, i) => {
          const active = i === selected;
          return (
            <li key={`${url}-${i}`}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${i + 1}번째 사진 선택`}
                className={`block aspect-square w-full overflow-hidden transition-all ${
                  active
                    ? 'ring-1 ring-[var(--mw-accent)] ring-offset-1 ring-offset-transparent'
                    : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          );
        })}
      </ul>

      {lightbox && (
        <Lightbox src={images[selected]} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      aria-label="닫기"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    </button>
  );
}
