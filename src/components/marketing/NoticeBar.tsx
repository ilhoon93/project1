'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { NoticeBarConfig } from '@/lib/marketing/notice-bar';

const DISMISS_KEY = 'wd_notice_dismissed';

/**
 * 홈 상단 전체폭 공지바 — 운영자 설정(marketing_notice_bar) 기반.
 *
 * enabled 가 꺼져 있거나 문구가 비면 아무것도 렌더하지 않는다. 닫기(×) 를 누르면
 * 현재 문구를 localStorage 에 기록해 같은 문구는 다시 표시하지 않는다(문구가
 * 바뀌면 다시 노출). 기존 고객 대상 개별 메시지를 갈음하는 안내용.
 */
export function NoticeBar({ config }: { config: NoticeBarConfig }) {
  const message = config.message.trim();
  const show = config.enabled && message.length > 0;
  // SSR/CSR 불일치 방지 — 마운트 후에만 dismissed 판정.
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === message);
    } catch {
      // storage 접근 불가 — 무시(항상 노출).
    }
  }, [message]);

  if (!show || (mounted && dismissed)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, message);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative z-[60] bg-[var(--wd-coral)] text-[var(--wd-cream)]">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-9 py-2 text-center text-[12.5px] font-medium leading-snug sm:text-[13px]">
        <span className="break-keep">{message}</span>
        {config.linkUrl.trim() && (
          <a
            href={config.linkUrl.trim()}
            target={config.linkUrl.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-full bg-[var(--wd-cream)]/20 px-2.5 py-0.5 text-[11.5px] font-semibold underline-offset-2 transition-colors hover:bg-[var(--wd-cream)]/30"
          >
            {config.linkLabel.trim() || '자세히 보기'} →
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="공지 닫기"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--wd-cream)]/80 transition-colors hover:bg-[var(--wd-cream)]/20 hover:text-[var(--wd-cream)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
