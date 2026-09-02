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
   * autoplayOnMount: 마운트 즉시 재생을 시도할지(기본 true). 진입 게이트가 있는
   * 뷰어에서는 false — 마운트 시엔 재생하지 않고, 첫 제스처(= 게이트 탭)에서만
   * 처음부터 재생한다(게이트 뒤에서 미리 재생되는 것 방지). 제스처 리스너는 그대로
   * 장착되므로 게이트 탭이 재생을 켠다.
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
  // 음악이 한 번이라도 재생 시작되면 true. 이후 자동재생(제스처) 로직은 완전히
  // 비활성 — 화면 터치가 음악을 다시 켜지 못하게 하는 이중 안전장치.
  const startedRef = useRef(false);
  // 자동재생 화면(autoStart)에서는 스피커 아이콘 기본값을 "재생(🔊)"으로 둔다.
  // 실제 재생은 정책상 첫 제스처가 필요할 수 있지만, 음악이 켜져 있음을 알리고
  // (탭하면 재생) 아이콘이 음소거처럼 보이지 않게 한다. 실제 play/pause 이벤트로 동기화.
  const [playing, setPlaying] = useState(autoStart);

  const syncPlaying = () => {
    const a = audioRef.current;
    setPlaying(!!a && !a.paused);
  };

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;
    const mountedAt = Date.now();

    // 자동재생을 "최초 1회 시작" 시키기 위한 제스처 리스너. 브라우저마다 활성화로
    // 인정하는 이벤트가 달라(Android 크롬은 pointerdown 만으론 인정 안 될 때가 많음)
    // 여러 이벤트를 건다. capture:true 로 다른 핸들러의 stopPropagation 을 피한다.
    //
    // ⚠️ 핵심: 음악이 한 번 재생되기 시작하면(자동재생·제스처·펄 버튼 무관) 이 리스너를
    // 즉시·영구 해제한다. 그래야 이후 화면을 아무리 터치해도 음악이 자동으로 다시
    // 재생되지 않는다(사용자가 펄로 끈 걸 터치가 되살리는 문제 방지).
    const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

    const removeAutoStart = () => {
      GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture, true));
      audio.removeEventListener('play', markStarted);
      audio.removeEventListener('playing', markStarted);
    };
    // 재생이 실제로 시작되면(자동재생·제스처·펄 버튼 무관) 자동재생 로직을 영구 종료.
    // play/playing 이벤트 + play() 성공 콜백 다중 감지 — 일부 인앱 WebView 는 특정
    // 이벤트를 누락하므로 여러 경로로 확실히 잡는다.
    const markStarted = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      removeAutoStart();
      syncPlaying();
    };
    const play = () => {
      // ⚠️ 이미 재생 중이면 절대 play() 를 다시 부르지 않는다. 카카오톡 인앱 WebView
      // 는 재생 중 오디오에 play() 가 오면 currentTime 을 0 으로 되감아 "처음부터"
      // 재생하는 버그가 있다. 정지 상태에서 최초 시작에만 play() 를 호출한다.
      if (startedRef.current || !audio.paused) return;
      audio.play().then(markStarted).catch(() => {
        /* 막히면 다음 제스처에서 다시 시도(started 전까지). */
      });
    };
    // 펄 버튼 위에서 시작된 제스처는 무시(버튼 onClick=toggle 이 단독 처리).
    const onGesture = (e: Event) => {
      if (startedRef.current) return; // 이미 재생 시작됨 → 터치가 음악을 다시 켜지 않음
      if (e.target instanceof Node && btnRef.current?.contains(e.target)) return;
      play();
    };

    audio.addEventListener('play', markStarted);
    audio.addEventListener('playing', markStarted);
    GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture, true));
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
        // 앱/탭 전환 후 복귀 시, 나가기 전 재생 중이었으면 이어서 재생 시도.
        // 실패해도 제스처 리스너를 재장착하지 않는다(터치 자동재생 방지). 필요 시
        // 사용자가 펄 버튼으로 다시 켠다.
        wasPlayingRef.current = false;
        audio.play().then(syncPlaying).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pauseForLeave);

    return () => {
      removeAutoStart();
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
