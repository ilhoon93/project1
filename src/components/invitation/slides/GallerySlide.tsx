'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import type {
  InvitationContent,
  ResolvedSectionHeader,
  GalleryImageFit,
} from '@/types/invitation';
import { SectionHeader } from './SectionHeader';

interface Props {
  gallery: InvitationContent['gallery'];
  invitationId: string;
  isPreview?: boolean;
  /** owner 모드 — 좋아요 클릭 비활성, 단순 카운트 표시. */
  mode?: 'guest' | 'owner';
  /** 사진 인덱스별 누적 좋아요 카운트 (owner view 진입 시 prefetch). */
  initialLikes?: Record<number, number>;
  header: ResolvedSectionHeader;
}

// 갤러리 사진 저장(내려받기) 방지 공통 속성.
//   - onContextMenu 차단: 데스크톱 우클릭 "이미지 저장"
//   - draggable=false: 드래그 저장/복사
//   - select-none + [-webkit-touch-callout:none]: iOS 길게 눌러 뜨는 저장/복사
//     콜아웃 및 선택 막기
// (웹 특성상 스크린샷까지 원천 차단은 불가 — 캐주얼 저장을 막는 표준 조치.)
const noSaveImgClass = 'select-none [-webkit-touch-callout:none]';
const preventCtxMenu = (e: React.MouseEvent) => e.preventDefault();

export function GallerySlide({
  gallery,
  invitationId,
  isPreview,
  mode = 'guest',
  initialLikes,
  header,
}: Props) {
  if (gallery.images.length === 0) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">갤러리</h2>
        <p className="text-sm opacity-70">아직 등록된 사진이 없습니다</p>
      </section>
    );
  }

  const layout = gallery.layout ?? 'grid';
  const fit = gallery.imageFit ?? 'cover';

  return (
    <section className="flex min-h-full flex-col gap-6 px-6 py-16">
      <SectionHeader header={header} />

      {layout === 'grid' ? (
        <GalleryGrid
          images={gallery.images}
          invitationId={invitationId}
          isPreview={isPreview}
          mode={mode}
          initialLikes={initialLikes}
          fit={fit}
        />
      ) : (
        <GallerySlider
          images={gallery.images}
          invitationId={invitationId}
          isPreview={isPreview}
          mode={mode}
          initialLikes={initialLikes}
          fit={fit}
        />
      )}
    </section>
  );
}

/**
 * 갤러리 큰 사진 — cover 는 3:4 를 채우고(잘림), contain 은 전체를 보여주고 남는
 * 여백을 같은 사진의 흐린 배경으로 채운다(잘림 없음).
 *
 * 확대는 기기 브라우저의 네이티브 핀치 줌으로 한다(모든 기기 동일). 별도 커스텀
 * 확대 UI 없이, 사진을 두 손가락으로 벌리면 화면이 확대된다.
 */
function GalleryHeroImage({ src, fit }: { src: string; fit: GalleryImageFit }) {
  return (
    <>
      {fit === 'contain' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl ${noSaveImgClass}`}
          draggable={false}
          onContextMenu={preventCtxMenu}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`relative h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${noSaveImgClass}`}
        draggable={false}
        onContextMenu={preventCtxMenu}
      />
    </>
  );
}

/** 사진 번호(N / M) 배지 — 우하단. */
function CountBadge({ current, total }: { current: number; total: number }) {
  return (
    <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
      {current} / {total}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 좋아요 hook + 하트 버튼 — Slider/Grid 양쪽에서 공유.
// ─────────────────────────────────────────────────────────────

function useLikes(invitationId: string, isPreview: boolean | undefined, initial: Record<number, number> | undefined) {
  const [counts, setCounts] = useState<Record<number, number>>(initial ?? {});
  const [bursts, setBursts] = useState<Record<number, number>>({});

  const like = (index: number) => {
    setCounts((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
    setBursts((prev) => ({ ...prev, [index]: Date.now() }));
    if (isPreview) return;
    void fetch('/api/guest/gallery-like', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ invitationId, imageIndex: index }),
    }).catch(() => {});
  };

  return { counts, bursts, like };
}

function HeartLikeButton({
  index,
  count,
  burstKey,
  onLike,
  disabled,
}: {
  index: number;
  count: number;
  burstKey: number | undefined;
  onLike: (i: number) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onLike(index);
      }}
      aria-label="이 사진 좋아요"
      className={`pointer-events-auto absolute bottom-2 left-2 z-30 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white transition-colors ${
        disabled ? 'cursor-default opacity-80' : 'hover:bg-black/75'
      }`}
    >
      <Heart size={13} className="fill-rose-400 text-rose-400" />
      <span className="tabular-nums">{count.toLocaleString()}</span>
      {burstKey && <FloatingHeart key={burstKey} />}
    </button>
  );
}

/** 클릭 순간 떠오르는 하트 애니메이션 — 1.2초 동안 위로 떠올라 사라진다. */
function FloatingHeart() {
  return (
    <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2">
      <span className="block animate-mw-heart-rise text-rose-400">
        <Heart size={20} className="fill-current" />
      </span>
      <style jsx>{`
        @keyframes mw-heart-rise {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.6);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -20px) scale(1.05);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -60px) scale(0.85);
          }
        }
        :global(.animate-mw-heart-rise) {
          animation: mw-heart-rise 1.2s ease-out forwards;
        }
      `}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 슬라이드형 — 중앙 큰 사진 + 하단 썸네일 5장. 메인 사진 좌우 스와이프로 전환.
// ─────────────────────────────────────────────────────────────

function GallerySlider({
  images,
  invitationId,
  isPreview,
  mode,
  initialLikes,
  fit,
}: {
  images: string[];
  invitationId: string;
  isPreview?: boolean;
  mode: 'guest' | 'owner';
  initialLikes?: Record<number, number>;
  fit: GalleryImageFit;
}) {
  const [index, setIndex] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 30;
  const { counts, bursts, like } = useLikes(invitationId, isPreview, initialLikes);

  const last = images.length - 1;
  const clamped = Math.max(0, Math.min(images.length - 1, index));

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
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
    // data-noswipe — SlideContainer 의 슬라이드 전환 스와이프와 분리.
    <div data-noswipe className="flex flex-col gap-3">
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="relative z-20">
        <div className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5">
          <GalleryHeroImage src={images[clamped]} fit={fit} />
          <CountBadge current={clamped + 1} total={images.length} />
        </div>
        <HeartLikeButton
          index={clamped}
          count={counts[clamped] ?? 0}
          burstKey={bursts[clamped]}
          onLike={like}
          disabled={mode === 'owner'}
        />
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
              <img
                src={url}
                alt=""
                className={`h-full w-full object-cover ${noSaveImgClass}`}
                loading="lazy"
                draggable={false}
                onContextMenu={preventCtxMenu}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 그리드형 — 상단에 선택 사진 크게 + 하단에 그리드. 사진 클릭 시 상단 사진 교체.
// ─────────────────────────────────────────────────────────────

function GalleryGrid({
  images,
  invitationId,
  isPreview,
  mode,
  initialLikes,
  fit,
}: {
  images: string[];
  invitationId: string;
  isPreview?: boolean;
  mode: 'guest' | 'owner';
  initialLikes?: Record<number, number>;
  fit: GalleryImageFit;
}) {
  const [selected, setSelected] = useState(0);
  const { counts, bursts, like } = useLikes(invitationId, isPreview, initialLikes);

  return (
    <div className="relative flex flex-col gap-3">
      <div className="relative z-20">
        <div className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5">
          <GalleryHeroImage src={images[selected]} fit={fit} />
          <CountBadge current={selected + 1} total={images.length} />
        </div>
        <HeartLikeButton
          index={selected}
          count={counts[selected] ?? 0}
          burstKey={bursts[selected]}
          onLike={like}
          disabled={mode === 'owner'}
        />
      </div>

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
                <img
                  src={url}
                  alt=""
                  className={`h-full w-full object-cover ${noSaveImgClass}`}
                  loading="lazy"
                  draggable={false}
                  onContextMenu={preventCtxMenu}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
