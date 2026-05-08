'use client';

import { useEffect, useState } from 'react';

/**
 * 카카오톡 인앱 브라우저 자동 우회.
 *
 * 동작:
 *   1) 페이지 진입 시 UA 의 'KAKAOTALK' 감지
 *   2) 즉시 `kakaotalk://web/openExternal?url=...` 로 시스템 브라우저 redirect 시도
 *   3) 1.5초 안에 redirect 안 되면 (스킴 실패 / 사용자 환경 이슈) fallback 오버레이 표시
 *   4) 사용자가 "그대로 보기" 누르면 sessionStorage 에 dismiss 기록
 *   5) 같은 카카오 webview 세션에서 redirect 1회만 자동 시도 — 사용자가 외부 브라우저
 *      에서 돌아오는 케이스를 대비. 두 번째부터는 오버레이만 표시.
 *
 * URL 자체로 카카오톡 인앱 진입을 막을 수는 없다 (페이지 로드 후에야 JS 가 실행되어
 * redirect 가능). 따라서 ~0.5-1.5초의 짧은 플래시는 불가피하다.
 */
export function InAppBrowserGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const isKakao = /KAKAOTALK/i.test(ua);
    if (!isKakao) return;
    if (sessionStorage.getItem('mw_kakao_inapp_dismiss') === '1') return;

    const alreadyAttempted =
      sessionStorage.getItem('mw_kakao_inapp_attempted') === '1';

    if (alreadyAttempted) {
      // 이미 한 번 자동 redirect 를 시도했음 → 사용자가 외부 브라우저 갔다 돌아왔거나
      // 스킴이 실패해서 다시 들어온 것. 자동 redirect 무한 루프 방지 위해 오버레이만.
      setShow(true);
      return;
    }

    sessionStorage.setItem('mw_kakao_inapp_attempted', '1');
    // 즉시 외부 브라우저로 redirect 시도.
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(
      window.location.href,
    )}`;

    // 1.5초 안에 redirect 가 안 되면 (스킴 미지원/사용자 환경 이슈) fallback.
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const openExternal = () => {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(
      window.location.href,
    )}`;
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
