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
  /**
   * autoplayOnMount: 마운트 즉시 재생을 시도할지. 기본 true.
   * 진입 인트로(게이트)가 있는 경우 false 로 주면, 마운트 시엔 재생하지 않고
   * (게이트 뒤에서 미리 재생/이중재생 방지) 첫 사용자 제스처(= 게이트 탭)에서만
   * 처음부터 재생한다. 제스처 리스너는 그대로 장착되므로 게이트 탭이 재생을 켠다.
   */
  autoplayOnMount?: boolean;
}

/**
 * 배경음악 ON/OFF 토글 — 슬라이드 컨테이너 좌하단 코너에 absolute 로 고정.
 *
 * 재생 정책(모든 기기에서 최대한 일관되게):
 *   - 마운트 시 소리 재생을 시도한다(자동재생 허용 환경이면 처음부터 재생).
 *   - 막히면(iOS 등) 첫 사용자 접촉에 재생한다. 진입 인트로(InvitationEntryGate)를
 *     탭하는 그 동작이 첫 접촉이 되어, 카톡/아이폰 포함 모든 기기에서 "입장과 동시에
 *     처음부터" 소리가 난다.
 *   - "무음으로 몰래 재생" 트릭은 쓰지 않는다(기기마다 중간부터/처음부터 재생이
 *     달라지고 아이콘이 어긋나는 문제 때문). 항상 처음부터, 아이콘도 정확히.
 *
 * 창 이탈 정지: pagehide(닫기)와 visibilitychange(탭/앱 전환) 로 정지. 단 로드 직후
 * 인앱 브라우저의 순간 hidden→visible 깜빡임(GRACE)은 무시해 자동재생이 끊기지 않게.
 */
const VISIBILITY_GRACE_MS = 2000;

export function BgmPlayer({ url, autoStart = true, autoplayOnMount = true }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wasPlayingRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  const syncPlaying = () => {
    const a = audioRef.current;
    setPlaying(!!a && !a.paused);
  };

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;
    const mountedAt = Date.now();

    // 다양한 "사용자 활성화" 이벤트에서 재생. 브라우저마다 활성화로 인정하는 이벤트가
    // 달라(Android 크롬은 pointerdown 만으론 인정 안 될 때가 많음) 여러 이벤트를 건다.
    // capture:true 로 다른 핸들러의 stopPropagation 을 피한다.
    const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const armGesture = () => {
      GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture, true));
    };
    const disarmGesture = () => {
      GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture, true));
    };

    const play = () => {
      audio
        .play()
        .then(() => {
          syncPlaying();
          disarmGesture();
        })
        .catch(() => {
          /* 막히면 다음 제스처/펄 버튼에서 다시 시도. */
        });
    };

    // 펄 버튼 위에서 시작된 제스처는 무시(버튼 onClick=toggle 이 단독 처리) — 아니면
    // 리스너가 재생을 켠 직후 toggle 이 곧바로 꺼버린다.
    const onGesture = (e: Event) => {
      if (e.target instanceof Node && btnRef.current?.contains(e.target)) return;
      play();
    };

    armGesture();
    // 게이트가 있으면(autoplayOnMount=false) 마운트 재생은 생략 — 게이트 탭(첫 제스처)에서만 재생.
    if (autoplayOnMount) play();

    // ── 창 이탈 정지 ─────────────────────────────────────────────
    const pauseForLeave = () => {
      if (!audio.paused) {
        wasPlayingRef.current = true;
        audio.pause();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (Date.now() - mountedAt < VISIBILITY_GRACE_MS) return; // 로드 직후 깜빡임 무시
        pauseForLeave();
      } else if (wasPlayingRef.current) {
        wasPlayingRef.current = false;
        audio.play().then(syncPlaying).catch(() => armGesture());
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pauseForLeave);

    return () => {
      disarmGesture();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pauseForLeave);
    };
  }, [url, autoStart, autoplayOnMount]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(syncPlaying).catch(() => syncPlaying());
    } else {
      audio.pause();
      syncPlaying();
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        loop
        preload="auto"
        onPlay={syncPlaying}
        onPause={syncPlaying}
      />
      {/* 좌하단 코너 — absolute 라 폰 프레임 안에서도 보인다. 배경색/라벨 없이 아이콘만
          둬서 콘텐츠를 가리지 않으며, 사진 위에서도 또렷하도록 drop-shadow 만 입힌다. */}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={playing ? '배경음악 끄기' : '배경음악 켜기'}
        className="pointer-events-auto absolute bottom-4 left-3 z-30 grid h-8 w-8 place-items-center bg-transparent text-xl leading-none transition-opacity hover:opacity-70"
        style={{ filter: 'drop-shadow(0 1px 2.5px rgba(0,0,0,0.6))' }}
      >
        <span aria-hidden>{playing ? '🔊' : '🔇'}</span>
      </button>
    </>
  );
}
