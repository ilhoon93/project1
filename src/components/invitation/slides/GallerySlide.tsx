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

// 갤러리 사진 저장(내려받기) 방지용 공통 속성.
//   - onContextMenu 차단: 데스크톱 우클릭 "이미지 저장" 막기
//   - draggable=false: 드래그해서 저장/복사 막기
//   - select-none + [-webkit-touch-callout:none]: iOS 길게 눌러 뜨는 "이미지 저장/
//     복사" 콜아웃 및 텍스트/이미지 선택 막기
// (웹 특성상 스크린샷까지 원천 차단은 불가 — 캐주얼 저장을 막는 표준 조치.)
const noSaveImgClass = 'select-none [-webkit-touch-callout:none]';
const preventCtxMenu = (e: React.MouseEvent) => e.preventDefault();

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

// ─────────────────────────────────────────────────────────────
// 인라인 확대 사진 (ZoomableImage)
// ─────────────────────────────────────────────────────────────

const ZOOM_MAX_SCALE = 4;
const ZOOM_DOUBLE_TAP_SCALE = 2.5;

function touchDist(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
const clampScale = (s: number) => Math.max(1, Math.min(ZOOM_MAX_SCALE, s));

/**
 * 갤러리 큰 사진을 "그 자리에서(인라인)" 확대해서 볼 수 있는 컴포넌트.
 * 전체화면(새 창)으로 넘어가지 않고, 사진 박스 안에서 바로 확대·이동한다.
 *
 * 확대 방법(모두 인라인):
 *   - ＋/－ 버튼: 어떤 기기(아이폰 포함)에서도 확실히 동작하는 기본 수단
 *   - 더블탭 / 더블클릭: 확대 ↔ 원위치 토글
 *   - 두 손가락 핀치: Android 는 touchmove 거리, iOS 사파리는 gesture 이벤트로 처리
 *   - 확대된 상태에서 한 손가락 드래그: 이동(pan), 휠(데스크톱): 확대/축소
 *
 * 제스처 충돌 완화:
 *   - 핀치는 "두 손가락" 에서만 → 한 손가락 스와이프/스크롤과 절대 겹치지 않음
 *   - 배율 1(원본) 일 때는 터치를 가로채지 않고 그대로 흘려보내(passthrough) 갤러리
 *     좌우 스와이프·세로 스크롤이 평소대로 동작
 *   - 확대된 상태(배율>1)에서만 한 손가락 드래그를 이동으로 캡처하고, 이때는
 *     stopPropagation 으로 슬라이드/사진 전환 스와이프를 차단
 *   - touch-action 을 동적으로(확대 시 none / 평상시 pan-y) 지정
 *   - iOS 페이지 확대는 gesturestart·touchmove preventDefault 로 억제
 */
function ZoomableImage({
  src,
  fit,
  enabled,
  children,
}: {
  src: string;
  fit: GalleryImageFit;
  enabled: boolean;
  /** 사진 위에 얹는 오버레이(좋아요 하트·번호 등). transform 영향 밖에서 렌더. */
  children?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [animate, setAnimate] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const clampPan = (s: number, x: number, y: number) => {
    const el = rootRef.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const maxX = ((s - 1) * w) / 2;
    const maxY = ((s - 1) * h) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const apply = (scale: number, tx: number, ty: number, withAnim = false) => {
    setAnimate(withAnim);
    if (scale <= 1) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }
    const p = clampPan(scale, tx, ty);
    setView({ scale, tx: p.x, ty: p.y });
  };

  const zoomBy = (delta: number) => {
    const cur = viewRef.current;
    const next = cur.scale <= 1 && delta > 0 ? ZOOM_DOUBLE_TAP_SCALE : cur.scale + delta;
    apply(clampScale(next), cur.tx, cur.ty, true);
  };

  // 사진이 바뀌면(슬라이더/그리드 선택 변경) 확대를 원위치로. key 로도 remount 되지만
  // 안전하게 src 변화에도 리셋한다.
  useEffect(() => {
    setAnimate(false);
    setView({ scale: 1, tx: 0, ty: 0 });
  }, [src]);

  useEffect(() => {
    if (!enabled) return;
    const el = rootRef.current;
    if (!el) return;

    // 핀치는 두 경로로 처리한다:
    //   1) touchmove 두 손가락 거리 (Android, 그리고 user-scalable=no 인 iOS)
    //   2) iOS/데스크톱 사파리 gesture 이벤트(e.scale)
    // gesture 이벤트가 실제로 발생하는 환경(스케일 허용된 사파리·맥 트랙패드)에서는
    // gestureActive 로 표시해 (1) 을 건너뛰어 둘이 겹쳐 튀지 않게 한다. iOS 라도
    // gesture 이벤트가 안 오는 경우(user-scalable=no, 일부 인앱 WebView)에는 (1) 이
    // 그대로 동작하므로 아이폰에서도 확대가 된다.
    let gestureActive = false;

    const g = {
      mode: 'idle' as 'idle' | 'pan' | 'pinch' | 'control',
      startDist: 0,
      startScale: 1,
      startX: 0,
      startY: 0,
      startTx: 0,
      startTy: 0,
      moved: false,
      lastTap: 0,
    };

    const isControl = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('[data-zoom-control]');

    const onStart = (e: TouchEvent) => {
      if (isControl(e.target)) {
        g.mode = 'control';
        return;
      }
      setAnimate(false);
      const cur = viewRef.current;
      if (e.touches.length === 2) {
        g.mode = 'pinch';
        g.startDist = touchDist(e.touches[0], e.touches[1]) || 1;
        g.startScale = cur.scale;
        g.startTx = cur.tx;
        g.startTy = cur.ty;
        g.moved = true;
        // 두 손가락 제스처는 스와이프가 아니므로 항상 차단 + 브라우저 확대 억제.
        e.preventDefault();
        e.stopPropagation();
      } else if (e.touches.length === 1) {
        g.mode = cur.scale > 1 ? 'pan' : 'idle';
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.startTx = cur.tx;
        g.startTy = cur.ty;
        g.moved = false;
        // 확대 상태에서만 캡처(이동). 배율 1 이면 흘려보내 스와이프/스크롤 허용.
        if (cur.scale > 1) e.stopPropagation();
      }
    };

    const onMove = (e: TouchEvent) => {
      if (g.mode === 'control') return;
      const cur = viewRef.current;
      if (g.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        if (gestureActive) return; // gesture 이벤트가 처리 중이면 중복 방지
        const d = touchDist(e.touches[0], e.touches[1]);
        const ns = clampScale(g.startScale * (d / g.startDist));
        const p = clampPan(ns, g.startTx, g.startTy);
        setView({ scale: ns, tx: p.x, ty: p.y });
      } else if (g.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
        const p = clampPan(cur.scale, g.startTx + dx, g.startTy + dy);
        setView({ scale: cur.scale, tx: p.x, ty: p.y });
      } else if (g.mode === 'idle' && e.touches.length === 1) {
        // passthrough — 스크롤/스와이프가 동작하도록 가로채지 않는다. 탭 판별만.
        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (g.mode === 'control') {
        g.mode = 'idle';
        return;
      }
      const cur = viewRef.current;
      if (e.touches.length > 0) {
        // 핀치 중 손가락 하나를 떼면 남은 손가락으로 이동 이어가기.
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
        if (cur.scale <= 1.01) apply(1, 0, 0, true);
        g.mode = viewRef.current.scale > 1 ? 'pan' : 'idle';
        return;
      }
      if (!g.moved) {
        const now = Date.now();
        if (now - g.lastTap < 300) {
          // 더블탭 — 확대 ↔ 원위치
          g.lastTap = 0;
          if (cur.scale > 1) apply(1, 0, 0, true);
          else apply(ZOOM_DOUBLE_TAP_SCALE, 0, 0, true);
        } else {
          g.lastTap = now;
        }
      } else if (cur.scale <= 1.01) {
        apply(1, 0, 0, true);
      }
      g.mode = viewRef.current.scale > 1 ? 'pan' : 'idle';
    };

    // iOS 사파리 핀치 — gesture 이벤트(e.scale 은 gesturestart 대비 누적 배율).
    let gestureStartScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      gestureActive = true;
      gestureStartScale = viewRef.current.scale;
      setAnimate(false);
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const scale = (e as unknown as { scale: number }).scale ?? 1;
      const ns = clampScale(gestureStartScale * scale);
      const cur = viewRef.current;
      const p = clampPan(ns, cur.tx, cur.ty);
      setView({ scale: ns, tx: p.x, ty: p.y });
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gestureActive = false;
      if (viewRef.current.scale <= 1.01) apply(1, 0, 0, true);
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
    // 최신 값은 viewRef 로 읽으므로 enabled 만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const zoomed = view.scale > 1;

  return (
    <div
      ref={rootRef}
      className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-black/5"
      style={{ touchAction: enabled ? (zoomed ? 'none' : 'pan-y') : undefined }}
      onWheel={
        enabled
          ? (e) => {
              const cur = viewRef.current;
              apply(clampScale(cur.scale - e.deltaY * 0.002), cur.tx, cur.ty, false);
            }
          : undefined
      }
      onDoubleClick={
        enabled
          ? () => {
              const cur = viewRef.current;
              if (cur.scale > 1) apply(1, 0, 0, true);
              else apply(ZOOM_DOUBLE_TAP_SCALE, 0, 0, true);
            }
          : undefined
      }
    >
      <div
        className="h-full w-full"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: 'center center',
          transition: animate ? 'transform 0.2s ease-out' : 'none',
          willChange: 'transform',
        }}
      >
        <GalleryHeroImage src={src} fit={fit} />
      </div>

      {children}

      {enabled && (
        <>
          {/* ＋/－ 버튼 — 우하단. 제스처를 몰라도(아이폰 포함) 탭으로 확실히 확대. */}
          <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1.5">
            <button
              type="button"
              data-zoom-control
              aria-label="축소"
              disabled={!zoomed}
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(-0.8);
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-xl leading-none text-white transition-colors hover:bg-black/75 disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              data-zoom-control
              aria-label="확대"
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(0.8);
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-xl leading-none text-white transition-colors hover:bg-black/75"
            >
              ＋
            </button>
          </div>
        </>
      )}
    </div>
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

/** 사진 번호(N / M) 배지 — 우상단(확대 버튼과 겹치지 않게). */
function CountBadge({ current, total }: { current: number; total: number }) {
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
      {current} / {total}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 슬라이드형 — 중앙 큰 사진 + 하단 썸네일 5장. 메인 사진 좌우 스와이프 시
// 썸네일도 같이 따라 움직이고, 썸네일을 누르면 메인이 해당 인덱스로 점프.
// (확대된 상태에서는 ZoomableImage 가 스와이프를 가로채지 않도록 stopPropagation.)
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
    // data-noswipe — SlideContainer 의 슬라이드 전환 스와이프와 분리. 갤러리 안 좌우
    // 스와이프는 메인 사진에서만 동작하고 슬라이드 전환엔 영향 주지 않도록.
    <div data-noswipe className="flex flex-col gap-3">
      {/* 중앙 큰 사진 — (배율 1) 좌우 스와이프로 사진 전환, (확대 시) 인라인 확대/이동. */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="relative z-20">
        <ZoomableImage key={images[clamped]} src={images[clamped]} fit={fit} enabled={allowZoom}>
          <CountBadge current={clamped + 1} total={images.length} />
          <HeartLikeButton
            index={clamped}
            count={counts[clamped] ?? 0}
            burstKey={bursts[clamped]}
            onLike={like}
            disabled={mode === 'owner'}
          />
        </ZoomableImage>
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
  const { counts, bursts, like } = useLikes(invitationId, isPreview, initialLikes);

  return (
    <div className="relative flex flex-col gap-3">
      {/* 상단 큰 사진 — 인라인 확대. */}
      <div className="relative z-20">
        <ZoomableImage key={images[selected]} src={images[selected]} fit={fit} enabled={allowZoom}>
          <CountBadge current={selected + 1} total={images.length} />
          <HeartLikeButton
            index={selected}
            count={counts[selected] ?? 0}
            burstKey={bursts[selected]}
            onLike={like}
            disabled={mode === 'owner'}
          />
        </ZoomableImage>
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
