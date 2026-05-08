'use client';

import { useEffect, useState } from 'react';

/**
 * 카카오톡 인앱 브라우저로 알림장이 열렸을 때 외부 브라우저로 안내하는 풀스크린 오버레이.
 *
 * 카카오톡에서 url 을 누르면 카카오 자체 인앱 뷰어가 열리는데, 하단의 카카오 컨트롤
 * (공유/북마크 바, 시계, 닫기) 때문에 9:16 풀블리드 알림장이 잘려 보인다. UA 로
 * 인앱 환경을 감지해, 사용자가 "외부 브라우저로 열기" 를 누르면 시스템 브라우저로
 * 즉시 전환되도록 한다.
 *
 * 카카오: `kakaotalk://web/openExternal?url=...`
 * 네이버 앱: `intent://...#Intent;...end` (Android) — 일단 카카오만 1차 대응.
 *
 * 사용자가 "그대로 보기" 를 누르면 sessionStorage 에 의도를 기억해 같은 탭에서
 * 다시 노출하지 않는다.
 */
export function InAppBrowserGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    // 카카오톡 인앱 브라우저는 UA 에 'KAKAOTALK' 을 항상 포함.
    const isKakao = /KAKAOTALK/i.test(ua);
    if (!isKakao) return;
    if (sessionStorage.getItem('mw_kakao_inapp_dismiss') === '1') return;
    setShow(true);
  }, []);

  if (!show) return null;

  const openExternal = () => {
    const url = window.location.href;
    // 카카오톡 인앱 → 시스템 브라우저로 강제 전환.
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  };

  const dismiss = () => {
    sessionStorage.setItem('mw_kakao_inapp_dismiss', '1');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center text-white">
      <div className="flex max-w-sm flex-col gap-3">
        <p className="text-base font-semibold leading-snug">
          카카오톡에서는 상하단 메뉴 때문에
          <br />
          알림장이 일부 가려질 수 있어요.
        </p>
        <p className="text-sm leading-relaxed text-white/80">
          아래 버튼을 누르면 외부 브라우저로 열려
          <br />
          전체 화면으로 깨끗하게 보실 수 있습니다.
        </p>
      </div>
      <button
        type="button"
        onClick={openExternal}
        className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-[0.98]"
      >
        외부 브라우저로 열기
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-white/60 underline-offset-2 hover:underline"
      >
        그대로 보기
      </button>
    </div>
  );
}
