'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // bfcache 가드: 로그아웃 후 router.push('/')로 이동했다 뒤로가기로
  // 돌아오면 브라우저가 이 컴포넌트를 메모리에서 복원해 busy=true가 남아
  // '로그아웃 중...'으로 멈춘다. pageshow.persisted=true일 때 리셋.
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
      router.refresh();
      router.push('/');
      // 네비게이션 시작과 함께 즉시 idle 상태로 — 새 페이지 마운트 후
      // 다시 사용 가능한 버튼이 되도록 한다. (위 pageshow 가드와는 별도)
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="text-xs text-[#5C4633] hover:text-[#3D2E1F] disabled:opacity-60"
    >
      {busy ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
