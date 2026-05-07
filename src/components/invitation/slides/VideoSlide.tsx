import type { InvitationContent } from '@/types/invitation';

export function VideoSlide({ video }: { video: InvitationContent['video'] }) {
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

  // 영화 스크린 느낌 — 슬라이드 전체를 어두운 배경으로 깔고, 영상은 가운데에서
  // 잘리지 않고 화면 안에 모두 들어가도록 배치. width=auto + height=auto + max
  // 만으로 채우면 브라우저가 16:9 비율을 유지하면서 가장 큰 사이즈를 자동
  // 으로 골라준다 (가로/세로 중 먼저 한계에 닿는 쪽이 100% 가 됨).
  return (
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center justify-center"
      style={{ backgroundColor: '#0A0A0C' }}
    >
      {/* 제목 — 상단에 살짝 */}
      {video.title && (
        <header className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center text-white/85">
          <p className="text-[10px] tracking-[0.3em] opacity-70">VIDEO</p>
          <h2 className="mt-1 text-sm font-light">{video.title}</h2>
        </header>
      )}

      {/* 영상 컨테이너 — width/height 둘 다 auto + max 100% + aspectRatio 로
          잘림 없이 슬라이드를 가능한 한 가득 채운다. */}
      <div
        className="relative overflow-hidden bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]"
        style={{
          aspectRatio: '16 / 9',
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
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
          />
        )}
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
