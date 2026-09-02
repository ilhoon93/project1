'use client';

import { useEffect, useState } from 'react';

/**
 * 카카오톡 인앱 브라우저 안내(비강제).
 *
 * 예전엔 카톡 진입 시 즉시 외부 브라우저로 자동 redirect 했지만, 그 방식은
 * "카톡의 완화된 자동재생 정책"을 버리고 외부 브라우저(콜드오픈 시 소리 자동재생
 * 금지)로 나가게 만들어 배경음악 자동재생이 깨지는 문제가 있었다. 그래서 자동
 * redirect 는 제거하고, 카톡 인앱에 그대로 머물러 소리가 입장과 동시에 나도록 한다.
 *
 * 대신 카톡 인앱의 상하단 메뉴바가 화면을 일부 가릴 수 있으므로, 원하는 사용자는
 * 직접 외부 브라우저로 열 수 있도록 작고 닫을 수 있는 안내 배너만 상단에 띄운다
 * (자동으로 내보내지 않음 — 누르는 순간이 사용자의 선택).
 */
export function InAppBrowserGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const isKakao = /KAKAOTALK/i.test(ua);
    if (!isKakao) return;
    if (sessionStorage.getItem('mw_kakao_inapp_dismiss') === '1') return;
    setShow(true);
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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full bg-black/80 py-2 pl-4 pr-2 text-xs text-white shadow-lg backdrop-blur">
        <span className="leading-snug">전체 화면으로 보시려면 외부 브라우저로 열어주세요</span>
        <button
          type="button"
          onClick={openExternal}
          className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black active:scale-[0.98]"
        >
          열기
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
