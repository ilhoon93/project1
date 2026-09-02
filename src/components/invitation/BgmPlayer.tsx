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
 * "링크 열자마자 재생"을 최대한 보장하기 위한 전략:
 *   1) 마운트 즉시 소리(unmuted) 재생을 시도한다. 링크 탭으로 들어온 경우 그 탭이
 *      사용자 활성화로 인정되어(특히 카카오톡/인스타 인앱 브라우저) 바로 소리가 난다.
 *   2) 브라우저 자동재생 정책으로 소리 재생이 막히면 → "무음(muted) 자동재생" 으로
 *      음악을 미리 굴려 두고, 첫 사용자 접촉(어떤 탭/스와이프/키 입력) 순간 곧바로
 *      음소거를 풀어 소리로 전환한다. 그래서 첫 순간에 바로 소리가 이어진다.
 *
 * ⚠️ iOS 사파리·Android 크롬 모두 "상호작용이 전혀 없는 소리 자동재생"은 브라우저
 * 정책으로 원천 차단되어 어떤 방법으로도 우회 불가하다. 위 2)는 그 제약 안에서
 * 가능한 "가장 이른 시점 재생"이다.
 */
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

  // 페이지가 화면에서 사라지면(탭 전환·앱 전환·인앱 브라우저 닫기 등) 음악을 멈춘다.
  // 카카오톡/인스타 인앱 브라우저(특히 안드로이드 WebView)는 링크를 닫아도 WebView
  // 를 곧바로 파괴하지 않고 백그라운드로만 내려, <audio loop> 가 계속 재생되는
  // 현상이 있다("창을 종료해도 음악이 계속됨"). visibilitychange/pagehide 로 감지해
  // 반드시 pause 하고, 다시 화면에 돌아오면 소리 나던 경우에만 이어서 재생한다.
  useEffect(() => {
    const onHidden = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused && !audio.muted) {
        wasAudibleRef.current = true;
        audio.pause();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onHidden();
      } else if (document.visibilityState === 'visible' && wasAudibleRef.current) {
        wasAudibleRef.current = false;
        const audio = audioRef.current;
        if (audio) {
          audio.muted = false;
          audio.play().catch(() => {
            /* 막히면 펄 버튼으로 다시 켤 수 있다. */
          });
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    // pagehide: iOS Safari·모바일 크롬에서 페이지가 bfcache 로 내려가거나 닫힐 때.
    window.addEventListener('pagehide', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onHidden);
    };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;

    // 다양한 "사용자 활성화" 이벤트에서 음소거를 풀고 소리 재생. 브라우저마다 활성화로
    // 인정하는 이벤트가 달라(Android 크롬은 pointerdown 만으론 인정 안 될 때가 많음)
    // 여러 이벤트를 모두 건다. capture:true 로 다른 핸들러의 stopPropagation 회피.
    const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const removeGestureListeners = () => {
      GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture, true));
    };

    // 첫 접촉에 소리로 전환(음소거 해제 + 재생). 성공하면 제스처 리스너 해제.
    const goAudible = () => {
      audio.muted = false;
      audio
        .play()
        .then(() => {
          syncAudible();
          removeGestureListeners();
        })
        .catch(() => {
          /* 그래도 막히면 다음 제스처/펄 버튼에서 다시. */
        });
    };

    // 펄 버튼 위에서 시작된 제스처는 무시(버튼 onClick=toggle 이 단독 처리) —
    // 그렇지 않으면 리스너가 재생을 켠 직후 toggle 이 곧바로 꺼버린다.
    const onGesture = (e: Event) => {
      if (e.target instanceof Node && btnRef.current?.contains(e.target)) return;
      goAudible();
    };
    GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture, true));

    // 1) 우선 소리(unmuted) 자동재생 시도 — 링크 탭 활성화가 전달되면 즉시 소리.
    audio.muted = false;
    audio
      .play()
      .then(() => {
        syncAudible();
        removeGestureListeners();
      })
      .catch(() => {
        // 2) 막히면 무음 자동재생으로 미리 굴려 두고, 첫 접촉에 음소거 해제.
        audio.muted = true;
        audio.play().then(syncAudible).catch(() => {});
      });

    return removeGestureListeners;
  }, [url, autoStart]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.muted) {
      // 소리 나는 중 → 끄기(일시정지).
      audio.pause();
      syncAudible();
    } else {
      // 정지/무음 → 소리로 재생.
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
