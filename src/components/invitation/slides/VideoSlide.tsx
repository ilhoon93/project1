'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';

export function VideoSlide({ video }: { video: InvitationContent['video'] }) {
  // 자체 호스팅 영상의 가로/세로 비율을 metadata 로드 시 측정.
  // 임베드(YouTube/Vimeo) iframe 은 aspect 알 길이 없어 16:9 기본값 유지.
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

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

  // 컨테이너 비율 — 자체 호스팅이고 metadata 가 로드된 경우에만 영상 실제 비율 사용,
  // 그 외엔 16:9 기본. 이렇게 해두면 세로 영상은 세로로, 가로 영상은 가로로 렌더된다.
  const aspect = videoAspect ?? 16 / 9;

  return (
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center"
      style={{ backgroundColor: '#0A0A0C' }}
    >
      {/* 제목 — 영상 위쪽 헤더 영역에 별도 배치. 영상에 겹치지 않도록 layout flow 안에 둠. */}
      {video.title && (
        <header
          className="z-10 flex w-full shrink-0 flex-col items-center text-center text-white/85"
          style={{ paddingTop: '4cqh', paddingBottom: '2cqh' }}
        >
          <p className="text-[10px] tracking-[0.3em] opacity-70">VIDEO</p>
          <h2 className="mt-1 text-sm font-light">{video.title}</h2>
        </header>
      )}

      {/* 영상 컨테이너 — 헤더 아래 남은 공간을 가득 차지. 가로/세로 잘림 없이
          가능한 한 가득 들어가도록 동적 비율 계산. */}
      <div className="flex flex-1 w-full items-center justify-center" style={{ minHeight: 0 }}>
        <div
          className="relative overflow-hidden bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]"
          style={{
            aspectRatio: `${aspect}`,
            width: `min(100cqw, calc((100cqh - 12cqh) * ${aspect}))`,
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
            <video
              src={video.url}
              controls
              className="absolute inset-0 h-full w-full object-contain"
              preload="metadata"
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.videoWidth > 0 && el.videoHeight > 0) {
                  setVideoAspect(el.videoWidth / el.videoHeight);
                }
              }}
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
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
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
