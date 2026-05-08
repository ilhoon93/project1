'use client';

import { useEffect, useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { VideoPlayer } from '../VideoPlayer';

export function VideoSlide({ video }: { video: InvitationContent['video'] }) {
  // 영상의 가로/세로 비율 — self-hosted 는 metadata 로 직접 측정,
  // 임베드(YouTube/Vimeo/Shorts) 는 URL 힌트로 추정.
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  // self-hosted 영상은 컨트롤되는 <video> 의 onLoadedMetadata 가 늦게 발화하거나
  // 누락되는 경우가 있어 (preload=metadata 가 무시되거나 첫 렌더가 16:9 박스로
  // 잠시 노출돼 세로 영상이 작게 보임) 별도 video element 로 프리로드 한다.
  useEffect(() => {
    if (!video.url) return;
    if (typeof document === 'undefined') return;
    if (isEmbeddable(video.url)) {
      // 임베드는 URL 힌트로 미리 비율 결정 (YouTube Shorts → 9:16).
      setVideoAspect(guessEmbedAspect(video.url));
      return;
    }
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.crossOrigin = 'anonymous';
    let canceled = false;
    const onMeta = () => {
      if (canceled) return;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setVideoAspect(v.videoWidth / v.videoHeight);
      }
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.src = video.url;
    return () => {
      canceled = true;
      v.removeEventListener('loadedmetadata', onMeta);
      v.src = '';
    };
  }, [video.url]);

  if (!video.url) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">{video.title || '우리의 영상'}</h2>
        <p className="text-sm opacity-70">영상이 등록되지 않았습니다</p>
      </section>
    );
  }

  const isExternal = isEmbeddable(video.url);
  const embedUrl = isExternal ? toEmbedUrl(video.url) : null;

  // 컨테이너 비율 — 측정/추정된 값을 사용. 아직 모르면 16:9 잠정 폴백.
  const aspect = videoAspect ?? 16 / 9;

  return (
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center"
      style={{ backgroundColor: '#0A0A0C' }}
    >
      {/* 제목 — 영상 위쪽 헤더 영역에 배치. 제목과 영상 사이 간격은 좁게. */}
      {video.title && (
        <header
          className="z-10 flex w-full shrink-0 flex-col items-center text-center text-white/85"
          style={{ paddingTop: '3cqh', paddingBottom: '0.6cqh' }}
        >
          <p className="text-[10px] tracking-[0.3em] opacity-70">VIDEO</p>
          <h2 className="mt-1 text-sm font-light">{video.title}</h2>
        </header>
      )}

      {/* 영상 컨테이너 — 헤더와 하단 인디케이터 사이의 남은 공간을 가득 차지.
          하단 paddingBottom 으로 슬라이드 인디케이터 점들과 영상이 겹치지 않게 띄움.
          영상 박스 자체에 z-20 + bg-black 을 줘서 슬라이드 z-10 의 배경 효과(별/펠탈) 가
          영상 위로 떨어지지 않게 한다. 영상 외 영역(헤더 / 좌우 letterbox) 에는 효과가 그대로 보임. */}
      <div
        className="flex w-full flex-1 items-center justify-center"
        style={{ minHeight: 0, paddingBottom: '5cqh' }}
      >
        <div
          className="relative z-20 overflow-hidden bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]"
          style={{
            aspectRatio: `${aspect}`,
            width: `min(100cqw, calc((100cqh - 10cqh) * ${aspect}))`,
            maxHeight: '100%',
          }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title || 'Wedding video'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <VideoPlayer
              src={video.url}
              className="absolute inset-0"
              onMeta={(aspect) => setVideoAspect(aspect)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function isEmbeddable(url: string) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes('youtube.com') ||
      u.hostname === 'youtu.be' ||
      u.hostname.includes('vimeo.com')
    );
  } catch {
    return false;
  }
}

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      // 표준 watch URL: youtube.com/watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      // Shorts URL: youtube.com/shorts/ID — 임베드 경로로 변환해야 iframe 에서 재생됨.
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * 임베드 URL 의 종류로 비율을 어림 잡는다 — YouTube Shorts 는 항상 9:16,
 * 그 외 일반 YouTube/Vimeo 는 16:9 가 기본. (정확한 값은 oEmbed API 등으로
 * 가져올 수 있지만 대부분 케이스에서 이 휴리스틱이면 충분.)
 */
function guessEmbedAspect(url: string): number {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && /^\/shorts\//.test(u.pathname)) {
      return 9 / 16;
    }
  } catch {
    // ignore
  }
  return 16 / 9;
}
