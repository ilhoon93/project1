'use client';

import { useEffect, useState } from 'react';

/**
 * 슬라이드 우상단의 작은 전체 화면 토글 버튼.
 *
 * - 데스크톱 / iOS 16.4+ / Android Chrome 등 Fullscreen API 지원 브라우저에서만 노출
 * - URL 쿼리 `?fs=1` 이 붙어 있으면 첫 탭 시 자동으로 fullscreen 요청
 *   (브라우저 보안 정책상 user gesture 가 필요해 페이지 로드 직후 자동 진입 불가)
 *
 * 모바일 브라우저는 보통 스크롤만으로 URL 바가 자동 축소되므로 이 버튼이 없어도
 * 풀블리드 알림장이 거의 화면을 다 채운다. 버튼은 노트북/PC 사용자를 위한 보조.
 */
export function FullscreenToggle() {
  const [supported, setSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const hasApi =
      typeof document.documentElement.requestFullscreen === 'function' ||
      // Safari prefix
      typeof (document.documentElement as unknown as { webkitRequestFullscreen?: () => void })
        .webkitRequestFullscreen === 'function';
    setSupported(hasApi);

    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // 마이페이지에서 ?fs=1 로 들어왔으면 첫 user gesture 에서 자동 fullscreen 진입.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!supported) return;
    if (new URLSearchParams(window.location.search).get('fs') !== '1') return;
    setPending(true);

    const tryEnter = async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // 일부 브라우저는 거부 — 무시.
      }
      setPending(false);
      document.removeEventListener('pointerdown', tryEnter);
    };
    document.addEventListener('pointerdown', tryEnter, { once: true });
    return () => document.removeEventListener('pointerdown', tryEnter);
  }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면'}
        className="pointer-events-auto fixed right-3 top-3 z-[150] grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
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
      {pending && !isFullscreen && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[140] flex justify-center">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white shadow">
            화면을 한 번 탭하면 전체 화면으로 전환돼요
          </span>
        </div>
      )}
    </>
  );
}
