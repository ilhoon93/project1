'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 자동 로그아웃 정책
 *
 *  1. **브라우저 종료 시**
 *     - 매 페이지 로드마다 sessionStorage에 `mw_session_active` 플래그를 찍는다.
 *     - localStorage에는 `mw_last_activity`(마지막 활동 시각, ms)를 기록한다.
 *     - 새 페이지가 열렸을 때 sessionStorage에 플래그가 없으면 = 브라우저(또는 탭)
 *       세션이 한 번 끊겼다는 뜻. 이 시점에 supabase.signOut() 호출.
 *     - sessionStorage는 탭/창 종료 시 자동으로 비워지므로 별도 beforeunload 훅
 *       없이도 신뢰 가능한 신호로 쓸 수 있다.
 *
 *  2. **유휴 시간 초과**
 *     - 30분 동안 사용자 입력(마우스/키보드/스크롤/포커스)이 없으면 로그아웃.
 *     - 다른 탭의 활동도 storage 이벤트로 같이 갱신해 탭별로 따로 세지 않는다.
 *
 *  컴포넌트는 root layout에 항상 mount되지만, 클라이언트에서 Supabase 세션을
 *  확인해 인증된 사용자에게만 활성화된다 — 비로그인 상태에서 storage 마커가
 *  남아 있어 잘못 로그아웃되는 일을 막기 위함.
 */

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const ACTIVITY_THROTTLE_MS = 30 * 1000; // 30초

const SESSION_KEY = 'mw_session_active';
const LAST_ACTIVITY_KEY = 'mw_last_activity';

export function AutoLogout() {
  const router = useRouter();

  useEffect(() => {
    let canceled = false;
    let cleanup: (() => void) | null = null;

    const safe = <T,>(fn: () => T, fallback: T): T => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };

    const supabase = createClient();

    const start = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || canceled) return;

      const signOut = async (reason: 'browser_closed' | 'idle_timeout') => {
        if (canceled) return;
        canceled = true;
        try {
          await supabase.auth.signOut();
        } catch {
          // already signed out — proceed
        }
        safe(() => sessionStorage.removeItem(SESSION_KEY), undefined);
        safe(() => localStorage.removeItem(LAST_ACTIVITY_KEY), undefined);
        router.replace(`/login?reason=${reason}`);
        router.refresh();
      };

      // ── 1) 브라우저 종료 감지 ──────────────────────────────
      const sessionFlag = safe(() => sessionStorage.getItem(SESSION_KEY), null);
      const lastActivity = Number(
        safe(() => localStorage.getItem(LAST_ACTIVITY_KEY), '0') ?? 0,
      );
      if (!sessionFlag && lastActivity > 0) {
        // 브라우저/탭이 한 번 닫혔다 다시 열렸다.
        await signOut('browser_closed');
        return;
      }
      safe(() => sessionStorage.setItem(SESSION_KEY, '1'), undefined);
      safe(() => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())), undefined);

      // ── 2) 유휴 타임아웃 ────────────────────────────────────
      let lastTouch = Date.now();
      let throttleAt = 0;

      const touch = () => {
        const now = Date.now();
        lastTouch = now;
        if (now - throttleAt < ACTIVITY_THROTTLE_MS) return;
        throttleAt = now;
        safe(() => localStorage.setItem(LAST_ACTIVITY_KEY, String(now)), undefined);
      };

      const events: (keyof DocumentEventMap)[] = [
        'mousemove',
        'mousedown',
        'keydown',
        'scroll',
        'touchstart',
        'visibilitychange',
      ];
      events.forEach((evt) => document.addEventListener(evt, touch, { passive: true }));

      const onStorage = (e: StorageEvent) => {
        if (e.key !== LAST_ACTIVITY_KEY || !e.newValue) return;
        const t = Number(e.newValue);
        if (t > lastTouch) lastTouch = t;
      };
      window.addEventListener('storage', onStorage);

      const interval = window.setInterval(() => {
        if (Date.now() - lastTouch > IDLE_TIMEOUT_MS) {
          void signOut('idle_timeout');
        }
      }, 60_000);

      cleanup = () => {
        events.forEach((evt) => document.removeEventListener(evt, touch));
        window.removeEventListener('storage', onStorage);
        window.clearInterval(interval);
      };
    };

    void start();

    return () => {
      canceled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
