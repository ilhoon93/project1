'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 마케팅 헤더의 우측 메뉴.
 *
 * 비로그인: AI 스냅 / 알림장 / 로그인 pill.
 * 로그인:  AI 스냅 / 알림장 / [사용자 이메일 콤보박스 — 마이페이지 / 로그아웃].
 *
 * 콤보박스 트리거는 사용자 이메일 앞부분(공간 제약상 truncate), 드롭다운
 * 헤더에는 전체 이메일을 그대로 노출. 바깥 클릭·Escape 시 닫힘.
 *
 * 모바일(< sm)에서는 이메일 텍스트를 생략하고 프로필 아이콘만 노출한다.
 * 메뉴 링크(AI 스냅/알림장/스마트스토어)와 이메일 pill 이 함께 있으면
 * 트리거 폭이 뷰포트를 넘어 가로 스크롤(우측 흰 공백)이 생기기 때문. 전체
 * 이메일은 드롭다운 헤더에서 확인할 수 있으므로 식별성도 유지된다.
 */
export function HeaderNav({
  loggedIn,
  email,
}: {
  loggedIn: boolean;
  /** 로그인 사용자 식별 표시값 — 트리거/드롭다운 모두 이메일로 노출. */
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="flex flex-shrink-0 items-center gap-3 sm:gap-5">
      <Link
        href="/designs"
        className="whitespace-nowrap text-[13px] text-[var(--wd-mute)] transition-colors hover:text-[var(--wd-ink)]"
      >
        알림장
      </Link>
      <Link
        href="/wedding-snap"
        className="whitespace-nowrap text-[13px] text-[var(--wd-mute)] transition-colors hover:text-[var(--wd-ink)]"
      >
        AI 스냅
      </Link>
      <a
        href="https://smartstore.naver.com/wooridaun"
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap text-[13px] text-[var(--wd-mute)] transition-colors hover:text-[var(--wd-ink)]"
      >
        스마트스토어
      </a>

      {loggedIn ? (
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--wd-ink)]/15 bg-[var(--wd-paper)]/70 px-3 py-1.5 text-[12px] font-medium text-[var(--wd-ink)] backdrop-blur transition-colors hover:border-[var(--wd-ink)]/35"
          >
            <ProfileIcon />
            <span className="hidden max-w-[18ch] truncate sm:inline">
              {email ?? '프로필'}
            </span>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-[var(--wd-line)] bg-[var(--wd-paper)] shadow-[0_18px_40px_rgba(31,27,23,0.18)]"
            >
              {email && (
                <div className="truncate border-b border-[var(--wd-line)] px-3 py-2 text-[12.5px] font-medium text-[var(--wd-ink)]">
                  {email}
                </div>
              )}
              <Link
                href="/mypage"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="block px-3 py-2.5 text-[13px] text-[var(--wd-ink)] transition-colors hover:bg-[var(--wd-cream)]"
              >
                마이페이지
              </Link>
              <Link
                href="/faq"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="block px-3 py-2.5 text-[13px] text-[var(--wd-ink)] transition-colors hover:bg-[var(--wd-cream)]"
              >
                도움말 · FAQ
              </Link>
              <LogoutMenuItem />
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/login?next=/"
          className="whitespace-nowrap rounded-full border border-[var(--wd-ink)]/25 px-3 py-1.5 text-[12px] font-medium text-[var(--wd-ink)]"
        >
          로그인
        </Link>
      )}
    </nav>
  );
}

function LogoutMenuItem() {
  const [busy, setBusy] = useState(false);

  // bfcache 가드 — pageshow.persisted 일 때 busy 리셋.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      try {
        sessionStorage.removeItem('mw_session_active');
        localStorage.removeItem('mw_last_activity');
      } catch {
        // storage unavailable — ignore
      }
    } finally {
      // Full reload to '/' — server components 가 비로그인 세션으로 재렌더.
      window.location.href = '/';
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={busy}
      role="menuitem"
      className="block w-full border-t border-[var(--wd-line)] px-3 py-2.5 text-left text-[13px] text-[var(--wd-ink)] transition-colors hover:bg-[var(--wd-cream)] disabled:opacity-60"
    >
      {busy ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}

function ProfileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="4.5" r="2.4" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M1.8 12.2C2.4 9.8 4.5 8.4 7 8.4s4.6 1.4 5.2 3.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
