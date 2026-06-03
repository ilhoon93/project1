'use client';

import { useState } from 'react';

/**
 * 발행용 알림장(하객용) 마지막 슬라이드의 공유하기 버튼.
 *
 * Web Share API(navigator.share)가 있으면 OS 공유 시트를 띄우고(모바일 대부분),
 * 없으면 현재 URL 을 클립보드로 복사한다. 공유 대상은 현재 페이지 URL —
 * 하객용 공개 슬러그 페이지에서 동작하므로 그대로 공유하면 된다.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = document.title || '우리 결혼합니다';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // 사용자가 공유 시트를 취소한 경우 — 무시.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard 미지원 — 무시.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="알림장 공유하기"
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mw-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-transform active:scale-[0.97]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {copied ? '링크 복사됨 ✓' : '공유하기'}
    </button>
  );
}
