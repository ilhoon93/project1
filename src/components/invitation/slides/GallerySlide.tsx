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
  const allowZoom = gallery.allowZoom ?? false;

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
          allowZoom={allowZoom}
        />
      ) : (
        <GallerySlider
          images={gallery.images}
          invitationId={invitationId}
          isPreview={isPreview}
          mode={mode}
          initialLikes={initialLikes}
          fit={fit}
          allowZoom={allowZoom}
        />
      )}
    </section>
  );
}

/**
 * 갤러리 큰 사진 — cover 는 3:4 를 채우고(잘림), contain 은 전체를 보여주고 남는
 * 여백을 같은 사진의 흐린 배경으로 채운다(잘림 없음).
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
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          draggable={false}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`relative h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        draggable={false}
      />
    </>
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
// 슬라이드형 — 중앙 큰 사진 + 하단 썸네일 5장. 메인 사진 좌우 스와이프 시
// 썸네일도 같이 따라 움직이고, 썸네일을 누르면 메인이 해당 인덱스로 점프.
// ─────────────────────────────────────────────────────────────

function GallerySlider({
  images,
  invitationId,
  isPreview,
  mode,
  initialLikes,
  fit,
  allowZoom,
}: {
  images: string[];
  invitationId: string;
  isPreview?: boolean;
  mode: 'guest' | 'owner';
  initialLikes?: Record<number, number>;
  fit: GalleryImageFit;
  allowZoom: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 30;
  const { counts, bursts, like } = useLikes(invitationId, isPreview, initialLikes);

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
          <GalleryHeroImage src={images[clamped]} fit={fit} />
          <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {clamped + 1} / {images.length}
          </span>
        </button>
        {/* 좌하단 하트 좋아요 버튼 — 메인 사진 단위로 카운트. */}
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
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>

      {lightbox && (
        <Lightbox src={images[clamped]} zoomable={allowZoom} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 그리드형 — 상단에 선택 사진 크게 + 하단에 그리드. 사진 클릭 시 상단 사진 교체.
// 첫 진입엔 첫 사진을 자동 선택해 큰 미리보기를 보여 준다.
// ─────────────────────────────────────────────────────────────

function GalleryGrid({
  images,
  invitationId,
  isPreview,
  mode,
  initialLikes,
  fit,
  allowZoom,
}: {
  images: string[];
  invitationId: string;
  isPreview?: boolean;
  mode: 'guest' | 'owner';
  initialLikes?: Record<number, number>;
  fit: GalleryImageFit;
  allowZoom: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const { counts, bursts, like } = useLikes(invitationId, isPreview, initialLikes);

  return (
    <div className="relative flex flex-col gap-3">
      {/* 상단 큰 사진 — z-20 으로 배경 효과 위로 올려 사진 위에 효과가 떨어지지 않게. */}
      <div className="relative z-20">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label="선택된 사진 확대"
          className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5"
        >
          <GalleryHeroImage src={images[selected]} fit={fit} />
          <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {selected + 1} / {images.length}
          </span>
        </button>
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
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          );
        })}
      </ul>

      {lightbox && (
        <Lightbox src={images[selected]} zoomable={allowZoom} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}

/**
 * 전체화면 사진 뷰어. zoomable 이면 ＋/－ 버튼·핀치 줌·더블탭·드래그로 사진을 더
 * 확대해서 볼 수 있다(사진 세부를 크게 보고 싶을 때). zoomable=false 면 예전처럼
 * 전체화면 한 장만 보여 준다.
 *
 * 닫기: 우측 상단 ✕ 버튼은 항상 동작. 사진 바깥(어두운 여백)을 탭/클릭해도 닫힌다.
 * 사진 위 단일 탭은 닫지 않는다(확대 조작과 헷갈리지 않게) — 더블탭은 확대 토글.
 *
 * 터치 이벤트는 React 합성 핸들러(패시브라 preventDefault 가 막힐 수 있음) 대신
 * 컨테이너에 native listener 를 { passive:false } 로 직접 붙여, 인앱 브라우저에서도
 * 브라우저 기본 핀치/스크롤에 가로채이지 않고 우리 확대가 확실히 동작하게 한다.
 */
const LIGHTBOX_MAX_SCALE = 4;
const LIGHTBOX_DOUBLE_TAP_SCALE = 2.5;

function touchDist(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function clampPanBox(s: number, x: number, y: number) {
  // 확대 배율만큼 화면 절반 범위 안에서만 이동 허용 → 사진이 화면 밖으로 완전히
  // 빠지지 않게 한다. 뷰포트 기준 근사치(자연 크기 측정 불필요).
  const maxX = ((s - 1) * window.innerWidth) / 2;
  const maxY = ((s - 1) * window.innerHeight) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

function Lightbox({
  src,
  zoomable,
  onClose,
}: {
  src: string;
  zoomable: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [animate, setAnimate] = useState(false);
  // native 리스너가 최신 값을 stale 없이 읽도록 ref 로 미러링.
  const viewRef = useRef(view);
  viewRef.current = view;

  const applyView = (scale: number, tx: number, ty: number, withAnim = false) => {
    setAnimate(withAnim);
    if (scale <= 1) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }
    const p = clampPanBox(scale, tx, ty);
    setView({ scale, tx: p.x, ty: p.y });
  };

  // ＋/－ 버튼 — 제스처를 몰라도 탭 한 번으로 확대/축소. 어떤 브라우저에서도 확실히 동작.
  const zoomBy = (delta: number) => {
    const cur = viewRef.current;
    const next = cur.scale <= 1 && delta > 0 ? LIGHTBOX_DOUBLE_TAP_SCALE : cur.scale + delta;
    applyView(Math.max(1, Math.min(LIGHTBOX_MAX_SCALE, next)), cur.tx, cur.ty, true);
  };

  useEffect(() => {
    if (!zoomable) return;
    const el = containerRef.current;
    if (!el) return;

    const g = {
      mode: 'none' as 'none' | 'pan' | 'pinch',
      startDist: 0,
      startScale: 1,
      startX: 0,
      startY: 0,
      startTx: 0,
      startTy: 0,
      moved: false,
      lastTap: 0,
      downOnBackdrop: false,
    };

    const onStart = (e: TouchEvent) => {
      setAnimate(false);
      const cur = viewRef.current;
      if (e.touches.length === 2) {
        g.mode = 'pinch';
        g.startDist = touchDist(e.touches[0], e.touches[1]) || 1;
        g.startScale = cur.scale;
        g.startTx = cur.tx;
        g.startTy = cur.ty;
        g.moved = true;
      } else if (e.touches.length === 1) {
        g.mode = cur.scale > 1 ? 'pan' : 'none';
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.startTx = cur.tx;
        g.startTy = cur.ty;
        g.moved = false;
        g.downOnBackdrop = e.target === el;
      }
    };

    const onMove = (e: TouchEvent) => {
      const cur = viewRef.current;
      if (g.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const d = touchDist(e.touches[0], e.touches[1]);
        const ns = Math.max(1, Math.min(LIGHTBOX_MAX_SCALE, g.startScale * (d / g.startDist)));
        const p = clampPanBox(ns, g.startTx, g.startTy);
        setView({ scale: ns, tx: p.x, ty: p.y });
      } else if (g.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
        const p = clampPanBox(cur.scale, g.startTx + dx, g.startTy + dy);
        setView({ scale: cur.scale, tx: p.x, ty: p.y });
      } else if (g.mode === 'none' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
      }
    };

    const onEnd = (e: TouchEvent) => {
      const cur = viewRef.current;
      // 핀치 중 손가락 하나를 떼면 남은 손가락으로 이동(pan) 이어가기.
      if (e.touches.length > 0) {
        if (cur.scale > 1) {
          g.mode = 'pan';
          g.startX = e.touches[0].clientX;
          g.startY = e.touches[0].clientY;
          g.startTx = cur.tx;
          g.startTy = cur.ty;
        }
        return;
      }
      if (g.mode === 'pinch') {
        if (cur.scale <= 1.01) applyView(1, 0, 0, true);
        g.mode = viewRef.current.scale > 1 ? 'pan' : 'none';
        return;
      }
      if (!g.moved) {
        const now = Date.now();
        if (now - g.lastTap < 300) {
          // 더블탭 — 확대/원위치 토글
          g.lastTap = 0;
          if (cur.scale > 1) applyView(1, 0, 0, true);
          else applyView(LIGHTBOX_DOUBLE_TAP_SCALE, 0, 0, true);
        } else {
          g.lastTap = now;
          // 사진 바깥(어두운 여백) 단일 탭 → 닫기. 사진 위 단일 탭은 아무 동작 안 함.
          if (g.downOnBackdrop && cur.scale <= 1) onClose();
        }
      } else if (cur.scale <= 1.01) {
        applyView(1, 0, 0, true);
      }
      g.mode = viewRef.current.scale > 1 ? 'pan' : 'none';
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // onClose/applyView 는 렌더마다 새로 생기지만 최신 값은 viewRef 로 읽으므로
    // zoomable 만 의존성으로 둔다(리스너 재부착 최소화).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable]);

  return (
    <div
      ref={containerRef}
      data-noswipe
      className="fixed inset-0 z-50 flex touch-none items-center justify-center overflow-hidden bg-black/90"
      // 데스크톱 마우스: 휠 확대/축소, 더블클릭 토글, 사진 바깥 클릭 시 닫기.
      onWheel={
        zoomable
          ? (e) => {
              const cur = viewRef.current;
              applyView(
                Math.max(1, Math.min(LIGHTBOX_MAX_SCALE, cur.scale - e.deltaY * 0.002)),
                cur.tx,
                cur.ty,
                false,
              );
            }
          : undefined
      }
      onDoubleClick={
        zoomable
          ? () => {
              const cur = viewRef.current;
              if (cur.scale > 1) applyView(1, 0, 0, true);
              else applyView(LIGHTBOX_DOUBLE_TAP_SCALE, 0, 0, true);
            }
          : undefined
      }
      onClick={(e) => {
        if (!zoomable) {
          onClose();
          return;
        }
        // 사진 바깥(컨테이너 자체) 클릭 시에만 닫기 — 마우스 전용. 모바일 탭은
        // native onEnd 가 처리한다(여기로 오는 합성 클릭은 target 이 컨테이너라도
        // 확대 상태에선 무시).
        if (e.target === e.currentTarget && viewRef.current.scale <= 1) onClose();
      }}
      role="dialog"
      aria-label="사진 확대 보기"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: animate ? 'transform 0.2s ease-out' : 'none',
          willChange: 'transform',
        }}
      />

      {/* 닫기 ✕ — 항상 노출. 확대 상태에서도 확실히 닫을 수 있는 명시적 버튼. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-2xl leading-none text-white transition-colors hover:bg-black/70"
      >
        ✕
      </button>

      {/* 확대/축소 버튼 — 제스처(핀치·더블탭)를 몰라도 탭으로 확실히 확대되게. */}
      {zoomable && (
        <div
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="축소"
              disabled={view.scale <= 1}
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(-0.8);
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-2xl leading-none text-white transition-colors hover:bg-black/75 disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              aria-label="확대"
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(0.8);
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-2xl leading-none text-white transition-colors hover:bg-black/75"
            >
              ＋
            </button>
          </div>
          {view.scale <= 1 && (
            <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/90">
              ＋ 버튼·더블탭·두 손가락으로 확대해서 볼 수 있어요
            </span>
          )}
        </div>
      )}
    </div>
  );
}
