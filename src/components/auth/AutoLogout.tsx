'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 자동 로그아웃 정책 — 유휴 타임아웃 전용
 *
 *   - 30분 동안 사용자 입력(마우스/키보드/스크롤/포커스)이 없으면 로그아웃.
 *   - 다른 탭의 활동도 storage 이벤트로 같이 갱신해 탭별로 따로 세지 않는다.
 *
 * 과거에는 sessionStorage 플래그로 "브라우저(또는 탭)가 한 번이라도 닫혔다
 * 열렸다"를 감지해 자동 로그아웃 시켰지만,
 *
 *   1) 같은 사이트를 새 탭으로 열면 sessionStorage 가 빈 채로 시작해
 *      `browser_closed` 로 오인되어 로그아웃되는 사례,
 *   2) iOS Safari 가 메모리 압박으로 탭을 정리한 뒤 복원하면 sessionStorage
 *      가 사라져 같은 false-positive 가 나는 사례,
 *
 * 가 빈번해 사용자 경험을 해쳐 제거. "브라우저를 닫으면 로그아웃" 은
 * 공유 PC 시나리오를 위한 기능인데, 그 가치 대비 실수 비용이 컸다.
 * 이제는 30분 유휴 타임아웃이 자동 로그아웃의 유일한 트리거다.
 */

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const ACTIVITY_THROTTLE_MS = 30 * 1000; // 30초

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

      const signOut = async (reason: 'idle_timeout') => {
        if (canceled) return;
        canceled = true;
        try {
          await supabase.auth.signOut();
        } catch {
          // already signed out — proceed
        }
        safe(() => localStorage.removeItem(LAST_ACTIVITY_KEY), undefined);
        router.replace(`/login?reason=${reason}`);
        router.refresh();
      };

      // 유휴 타임아웃 — 활동 추적
      let lastTouch = Date.now();
      let throttleAt = 0;
      safe(() => localStorage.setItem(LAST_ACTIVITY_KEY, String(lastTouch)), undefined);

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
