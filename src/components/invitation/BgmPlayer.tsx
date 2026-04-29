'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  url: string;
  /** Optional — color of the toggle pill (matches theme accent). */
  color?: string;
}

/**
 * Floating background-music toggle pinned to the top-right of the screen.
 *
 * Browser autoplay-with-sound policies (Chrome, Safari, iOS) block automatic
 * playback until the user has interacted with the page, so we don't try to
 * autoplay on mount. We attempt one play() on the first user pointer/key
 * interaction with the document (which always succeeds because it counts as
 * a gesture), and the floating pill always lets the user mute or restart
 * playback manually.
 */
export function BgmPlayer({ url, color }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Wire up: try to start on first user gesture. We add the listener once
  // and remove it after success.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          window.removeEventListener('pointerdown', tryPlay);
          window.removeEventListener('keydown', tryPlay);
        })
        .catch(() => {
          // Browser still refused — leave the listeners attached so the next
          // gesture (e.g. tapping the play pill) is the trigger.
        });
    };

    window.addEventListener('pointerdown', tryPlay, { once: false });
    window.addEventListener('keydown', tryPlay, { once: false });
    return () => {
      window.removeEventListener('pointerdown', tryPlay);
      window.removeEventListener('keydown', tryPlay);
    };
  }, [url]);

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
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? '음악 끄기' : '음악 재생'}
        className="pointer-events-auto fixed right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full bg-white/30 text-base shadow-sm backdrop-blur-sm transition-colors hover:bg-white/50"
        style={{ color: color ?? '#3D2E1F' }}
      >
        {playing ? '🔊' : '🔈'}
      </button>
    </>
  );
}
