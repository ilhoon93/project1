'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 자동 로그인 게이트
 *
 *   - 로그인 페이지에서 사용자가 "자동 로그인" 체크박스를 끄고 로그인하면
 *     localStorage 에 `mw_auto_login = '0'` 가 기록된다.
 *   - 브라우저를 닫았다가 다시 열면 sessionStorage 가 비어 있는데, 이 시점에
 *     auto-login 플래그가 '0' 이면 즉시 signOut + /login 으로 보내 새로 로그인하게 함.
 *   - 같은 브라우저 세션 안의 페이지 이동에서는 sessionStorage 마커가 살아 있어
 *     계속 로그인 상태가 유지된다.
 *   - 플래그가 미설정이거나 '1' 이면 기존 동작(쿠키 세션 유지) 그대로.
 *
 * AutoLogout 의 30분 유휴 타임아웃과 독립적으로 동작 — 두 정책은 함께 적용된다.
 */

const AUTO_LOGIN_KEY = 'mw_auto_login';
const SESSION_ACTIVE_KEY = 'mw_session_active';

export function AutoLoginGate() {
  const router = useRouter();

  useEffect(() => {
    let canceled = false;

    const safe = <T,>(fn: () => T, fallback: T): T => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };

    const sessionActive = safe(
      () => sessionStorage.getItem(SESSION_ACTIVE_KEY),
      null,
    );
    if (sessionActive === '1') return; // 같은 브라우저 세션 안에서는 검사 생략

    const autoLogin = safe(() => localStorage.getItem(AUTO_LOGIN_KEY), null);
    // 플래그가 명시적으로 '0' 일 때만 강제 로그아웃. 미설정/'1' 은 기존 자동 로그인 동작.
    if (autoLogin !== '0') {
      safe(() => sessionStorage.setItem(SESSION_ACTIVE_KEY, '1'), undefined);
      return;
    }

    const supabase = createClient();
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (canceled) return;
      if (!session) {
        // 이미 로그아웃 상태라면 마커만 켜두고 종료.
        safe(() => sessionStorage.setItem(SESSION_ACTIVE_KEY, '1'), undefined);
        return;
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // already signed out — proceed
      }
      safe(() => sessionStorage.setItem(SESSION_ACTIVE_KEY, '1'), undefined);
      router.replace('/login?reason=auto_login_off');
      router.refresh();
    })();

    return () => {
      canceled = true;
    };
  }, [router]);

  return null;
}
