'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  // bfcache 가드: 로그아웃 후 '/'로 이동했다 뒤로가기로 돌아오면 브라우저가
  // 이 컴포넌트를 메모리에서 복원해 busy=true가 남아 '로그아웃 중...'으로
  // 멈춘다. pageshow.persisted=true일 때 리셋.
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
      // Full reload to '/' so server components re-render with the
      // signed-out session — also satisfies the "refresh once on logout"
      // requirement.
      window.location.href = '/';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="whitespace-nowrap text-xs text-[var(--wd-mute)] hover:text-[var(--wd-ink)] disabled:opacity-60"
    >
      {busy ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
