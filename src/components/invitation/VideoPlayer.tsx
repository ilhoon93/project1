'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  /** 메타데이터 로드 직후 video element 의 width/height 를 부모에 알려준다 (비율 산출용). */
  onMeta?: (aspect: number) => void;
  className?: string;
}

/**
 * 결혼식 영상용 커스텀 플레이어. native `<video controls>` 가 OS/브라우저별로
 * 다르게 보이는 문제를 피하고 테마 강조색(--mw-accent) 으로 통일된 UI 제공.
 *
 * 컨트롤:
 *   - 가운데 큰 재생 버튼 (정지 상태에만 노출)
 *   - 하단 컨트롤 바: 재생/일시정지 · 진행 바 · 시간 · 음소거 · 전체화면
 *   - 일정 시간 마우스/탭 없으면 컨트롤 자동 페이드아웃 (재생 중일 때만)
 *
 * 영상 자체 클릭으로도 재생/일시정지 토글. iOS 인라인 재생 지원 (playsInline).
 */
export function VideoPlayer({ src, onMeta, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 재생 중일 때만 일정 시간 후 컨트롤 자동 숨김.
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2200);
  };
  const showAndScheduleHide = () => {
    setShowControls(true);
    scheduleHide();
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // ignore — 일부 브라우저(iOS Safari < 16.4) 미지원.
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`group relative h-full w-full select-none overflow-hidden bg-black ${className ?? ''}`}
      onMouseMove={showAndScheduleHide}
      onPointerDown={showAndScheduleHide}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-contain"
        playsInline
        preload="metadata"
        muted={muted}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDuration(el.duration || 0);
          if (el.videoWidth > 0 && el.videoHeight > 0) {
            onMeta?.(el.videoWidth / el.videoHeight);
          }
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* 정지 상태 — 가운데 큰 재생 버튼 오버레이 */}
      {!playing && (
        <button
          type="button"
          aria-label="재생"
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/35 transition-opacity"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-black shadow-2xl backdrop-blur active:scale-95">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* 하단 컨트롤 바 — 재생 중엔 자동 페이드, 정지 상태에선 항상 보임 */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pb-3 pt-6 text-white transition-opacity duration-300 ${
          showControls || !playing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 진행 바 — 클릭/드래그로 시크 */}
        <div
          className="pointer-events-auto group/seek relative h-7 cursor-pointer"
          onClick={seek}
          onTouchStart={seek}
          role="slider"
          aria-label="재생 위치"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/30">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--mw-accent, #ffffff)',
              }}
            />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow opacity-0 transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-3 text-[11px] tabular-nums">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? '일시정지' : '재생'}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <span>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? '음소거 해제' : '음소거'}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
            >
              {muted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12A4.5 4.5 0 0014 8.04v2.21l2.45 2.45c.03-.23.05-.46.05-.7zM3 9v6h4l5 5V4L7 9H3zm16.5 3c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.94 8.94 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z" opacity="0.4" />
                  <path d="M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.04v7.91A4.5 4.5 0 0016.5 12zM14 3.23v2.06A6.99 6.99 0 0119 12a6.99 6.99 0 01-5 6.71v2.06A8.99 8.99 0 0021 12 8.99 8.99 0 0014 3.23z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
            >
              {isFullscreen ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 9V3M9 9H3M15 9V3M15 9h6M9 15v6M9 15H3M15 15v6M15 15h6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
