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
  // 잘리지 않고 화면 안에 가능한 한 가득 들어가도록 배치.
  //
  // SlideContainer 가 containerType: 'size' 를 깔아두기 때문에 cqw/cqh 가
  // 슬라이드 박스 기준으로 동작한다. width 를 min(가로 100%, 세로*16/9) 로 잡으면
  // 16:9 비율이 잘리지 않으면서 가용 공간을 최대로 활용한다.
  // (이전 PR 의 width:auto + max-width 조합은 flex items-center 안에서 width
  //  가 0 으로 줄어들어 영상이 안 보이는 버그가 있어 명시 width 로 수정.)
  return (
    <section
      className="relative flex h-full min-h-full w-full items-center justify-center"
      style={{ backgroundColor: '#0A0A0C' }}
    >
      {/* 제목 — 상단에 살짝 */}
      {video.title && (
        <header className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center text-white/85">
          <p className="text-[10px] tracking-[0.3em] opacity-70">VIDEO</p>
          <h2 className="mt-1 text-sm font-light">{video.title}</h2>
        </header>
      )}

      {/* 영상 컨테이너 — 슬라이드(컨테이너) 안에 들어가는 가장 큰 16:9 박스 */}
      <div
        className="relative overflow-hidden bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]"
        style={{
          aspectRatio: '16 / 9',
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
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
