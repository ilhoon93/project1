'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  url: string;
  /**
   * autoStart: 마운트 시 + 첫 제스처에 자동재생을 시도할지. 실제 하객/소장용
   * 화면이나 /preview 전체보기에서는 true. 에디터 실시간 미리보기처럼 "버튼은
   * 보이되 편집 중 소리가 저절로 나면 곤란한" 곳에서는 false — 이때는 펄 버튼을
   * 탭해야만 재생된다. 기본 true.
   */
  autoStart?: boolean;
}

/**
 * 배경음악 ON/OFF 토글 — 슬라이드 컨테이너 좌하단 코너에 absolute 로 고정.
 *
 * position 을 fixed 가 아닌 absolute 로 둬, 데스크톱 폰 프레임(소장용/하객용 뷰)
 * 안에서도 프레임 기준으로 보이게 한다(예전 fixed 는 브라우저 화면 구석에 떨어져
 * "안 보이는" 문제가 있었음). 위치는 메인 슬라이드의 제목(중앙)·헤더(상단 중앙)·
 * 축하하기/인디케이터(하단 중앙)·좌우 화살표(세로 중앙)와 겹치지 않는 좌하단 코너.
 *
 * 브라우저 자동재생 정책(Chrome/Safari/iOS)상 소리 자동재생은 첫 사용자 제스처
 * 전엔 막히므로, 첫 pointer/key 제스처에 한 번 play() 를 시도하고, 펄 버튼으로
 * 언제든 끄거나 다시 켤 수 있다.
 */
export function BgmPlayer({ url, autoStart = true }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wasPlayingRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  // 페이지가 화면에서 사라지면(탭 전환·앱 전환·인앱 브라우저 닫기 등) 음악을 멈춘다.
  // 카카오톡/인스타 인앱 브라우저(특히 안드로이드 WebView)는 링크를 닫아도 WebView
  // 를 곧바로 파괴하지 않고 백그라운드로만 내려, <audio loop> 가 계속 재생되는
  // 현상이 있다("창을 종료해도 음악이 계속됨"). visibilitychange/pagehide 로 감지해
  // 반드시 pause 하고, 다시 화면에 돌아오면 재생 중이던 경우에만 이어서 재생한다.
  useEffect(() => {
    const onHidden = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        wasPlayingRef.current = true;
        audio.pause();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onHidden();
      } else if (document.visibilityState === 'visible' && wasPlayingRef.current) {
        wasPlayingRef.current = false;
        audioRef.current?.play().catch(() => {
          /* 자동재생이 막히면 사용자가 펄 버튼으로 다시 켤 수 있다. */
        });
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

  // Wire up: try to start on first user gesture. We add the listener once
  // and remove it after success. autoStart=false 면 자동재생/제스처 리스너를
  // 아예 걸지 않고, 펄 버튼 탭(toggle)으로만 재생한다(에디터 미리보기용).
  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;

    const start = () => {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          window.removeEventListener('pointerdown', onGesture);
          window.removeEventListener('keydown', onGesture);
        })
        .catch(() => {
          // Browser still refused — leave the listeners attached so the next
          // gesture (e.g. tapping the play pill) is the trigger.
        });
    };

    // 재생 켜기/끄기 버튼(펄) 위에서 시작된 제스처는 무시한다. 그렇지 않으면
    // 같은 탭에서 이 window 리스너가 pointerdown 에 재생을 시작하고, 이어지는
    // 버튼 click(=toggle) 이 곧바로 일시정지시켜 "펄을 눌러도 음악이 안 나오는"
    // 현상이 생긴다. 펄 탭은 버튼의 onClick(toggle) 에게만 맡긴다.
    const onGesture = (e: Event) => {
      if (e.target instanceof Node && btnRef.current?.contains(e.target)) return;
      start();
    };

    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
    // 처음 열었을 때 바로 재생 시도 (기본값 = 재생). 브라우저 자동재생 정책이
    // 막으면 위 제스처 리스너가 첫 탭/키 입력에서 다시 시도한다.
    start();
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [url, autoStart]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {/* 좌하단 코너 — absolute 라 폰 프레임 안에서도 보인다. 배경색/라벨 없이 아이콘만
          둬서 콘텐츠를 가리지 않으며, 사진 위에서도 또렷하도록 drop-shadow 만 입힌다.
          작은 히트박스(아이콘 크기)라 다른 요소 위를 거의 점유하지 않음. */}
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
