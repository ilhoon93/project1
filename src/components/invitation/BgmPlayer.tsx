'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  url: string;
  /**
   * autoStart: 마운트 시 자동재생을 시도할지. 실제 하객/소장용 화면이나 /preview
   * 전체보기에서는 true. 에디터 실시간 미리보기처럼 "버튼은 보이되 편집 중 소리가
   * 저절로 나면 곤란한" 곳에서는 false — 이때는 펄 버튼을 탭해야만 재생된다. 기본 true.
   */
  autoStart?: boolean;
}

/**
 * 배경음악 ON/OFF 토글 — 슬라이드 컨테이너 좌하단 코너에 absolute 로 고정.
 *
 * "링크 열자마자 재생"을 최대한 보장:
 *   1) 마운트 즉시 소리(unmuted) 재생 시도. 링크 탭으로 들어온 경우 그 탭이 사용자
 *      활성화로 인정되는 브라우저/인앱(카카오톡 등)에서는 바로 소리가 난다.
 *   2) 정책으로 막히면 무음(muted) 자동재생으로 미리 굴려 두고, 첫 사용자 접촉
 *      순간 음소거를 풀어 소리로 전환한다.
 *
 * 창 이탈 정지:
 *   - pagehide(닫기/이탈) 시 정지.
 *   - visibilitychange(탭/앱 전환)로도 정지하되, "로드 직후 인앱 브라우저가 순간
 *     hidden→visible 로 깜빡이는" 구간(GRACE_MS)은 무시한다. 이 깜빡임에 반응해
 *     정지하면 이후 자동 재개가 제스처 없이는 막혀(iOS) '한 번 터치해야 재생되는'
 *     문제가 생기기 때문. 복귀 시 재생이 막히면 다음 사용자 접촉에 재개한다.
 *
 * ⚠️ iOS/Android 모두 "상호작용 0 상태의 소리 자동재생"은 정책상 원천 차단이라
 * 완전 무접촉 재생은 불가하다. 위는 그 제약 안에서의 최대치.
 */
const VISIBILITY_GRACE_MS = 2000;

export function BgmPlayer({ url, autoStart = true }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wasAudibleRef = useRef(false);
  // 실제로 "소리가 나는" 상태(재생 중 + 음소거 아님)만 true.
  const [audible, setAudible] = useState(false);

  const syncAudible = () => {
    const a = audioRef.current;
    setAudible(!!a && !a.paused && !a.muted);
  };

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;
    const mountedAt = Date.now();

    // 다양한 "사용자 활성화" 이벤트에서 음소거 해제 + 재생. 브라우저마다 활성화로
    // 인정하는 이벤트가 달라(Android 크롬은 pointerdown 만으론 인정 안 될 때가 많음)
    // 여러 이벤트를 건다. capture:true 로 다른 핸들러의 stopPropagation 회피.
    const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const armGesture = () => {
      GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture, true));
    };
    const disarmGesture = () => {
      GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture, true));
    };

    const goAudible = () => {
      audio.muted = false;
      audio
        .play()
        .then(() => {
          syncAudible();
          disarmGesture();
        })
        .catch(() => {
          /* 그래도 막히면 다음 제스처/펄 버튼에서 다시. */
        });
    };

    // 펄 버튼 위에서 시작된 제스처는 무시(버튼 onClick=toggle 이 단독 처리).
    const onGesture = (e: Event) => {
      if (e.target instanceof Node && btnRef.current?.contains(e.target)) return;
      goAudible();
    };

    armGesture();

    // 1) 소리(unmuted) 자동재생 즉시 시도.
    audio.muted = false;
    audio
      .play()
      .then(() => {
        syncAudible();
        disarmGesture();
      })
      .catch(() => {
        // 2) 막히면 무음 자동재생으로 굴려 두고 첫 접촉에 음소거 해제.
        audio.muted = true;
        audio.play().then(syncAudible).catch(() => {});
      });

    // ── 창 이탈 정지 ─────────────────────────────────────────────
    const pauseForLeave = () => {
      if (!audio.paused && !audio.muted) {
        wasAudibleRef.current = true;
        audio.pause();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // 로드 직후 인앱 브라우저의 순간 깜빡임은 무시 — 여기에 반응해 정지하면
        // 자동재생이 곧바로 멈춰 "한 번 터치해야 재생" 문제가 생긴다.
        if (Date.now() - mountedAt < VISIBILITY_GRACE_MS) return;
        pauseForLeave();
      } else if (wasAudibleRef.current) {
        wasAudibleRef.current = false;
        audio.muted = false;
        audio.play().then(syncAudible).catch(() => {
          // 복귀 재생이 막히면(iOS 제스처 필요) 다음 사용자 접촉에 재개.
          armGesture();
        });
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    // pagehide: 닫기/이탈은 확실히 정지(인앱 브라우저가 백그라운드에서 계속 재생하는 것 방지).
    window.addEventListener('pagehide', pauseForLeave);

    return () => {
      disarmGesture();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pauseForLeave);
    };
  }, [url, autoStart]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.muted) {
      audio.pause();
      syncAudible();
    } else {
      audio.muted = false;
      audio
        .play()
        .then(syncAudible)
        .catch(() => syncAudible());
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        loop
        preload="auto"
        onPlay={syncAudible}
        onPause={syncAudible}
        onVolumeChange={syncAudible}
      />
      {/* 좌하단 코너 — absolute 라 폰 프레임 안에서도 보인다. 배경색/라벨 없이 아이콘만
          둬서 콘텐츠를 가리지 않으며, 사진 위에서도 또렷하도록 drop-shadow 만 입힌다.
          작은 히트박스(아이콘 크기)라 다른 요소 위를 거의 점유하지 않음. */}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={audible ? '배경음악 끄기' : '배경음악 켜기'}
        className="pointer-events-auto absolute bottom-4 left-3 z-30 grid h-8 w-8 place-items-center bg-transparent text-xl leading-none transition-opacity hover:opacity-70"
        style={{ filter: 'drop-shadow(0 1px 2.5px rgba(0,0,0,0.6))' }}
      >
        <span aria-hidden>{audible ? '🔊' : '🔇'}</span>
      </button>
    </>
  );
}
