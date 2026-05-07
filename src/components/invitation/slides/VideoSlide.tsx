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
  // 잘리지 않고 화면 안에 모두 들어가도록(object-contain / aspect-ratio 유지) 배치.
  // 영상이 차지하지 않는 위·아래(혹은 좌·우) 영역은 배경색 그대로 노출돼
  // letterbox 효과를 낸다. 제목은 상단에 작게 얹어 영상 시청을 방해하지 않음.
  return (
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center justify-center"
      style={{ backgroundColor: '#0A0A0C' }}
    >
      {/* 제목 — 상단에 살짝, 흰색으로 어두운 배경 위 가독성 확보 */}
      {video.title && (
        <header className="absolute left-1/2 top-6 z-10 -translate-x-1/2 text-center text-white/85">
          <p className="text-[10px] tracking-[0.3em] opacity-70">VIDEO</p>
          <h2 className="mt-1 text-sm font-light">{video.title}</h2>
        </header>
      )}

      {/* 영상 컨테이너 — 화면 폭/높이 기준으로 16:9 가 잘리지 않게 들어가도록.
          embed iframe 은 자체적으로 항상 컨테이너에 맞춰 letterbox 처리되므로
          고정 16:9 박스를 화면 안에 fit 시키고, 그 외 영역은 슬라이드 배경이
          그대로 letterbox 색으로 보이게 둔다. */}
      <div className="flex h-full w-full items-center justify-center px-3">
        <div
          className="relative w-full max-w-full overflow-hidden rounded-sm bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]"
          style={{
            aspectRatio: '16 / 9',
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
            // 자체 호스팅 mp4 등 — object-contain 으로 잘림 없이 컨테이너에 맞춤.
            <video
              src={video.url}
              controls
              className="absolute inset-0 h-full w-full object-contain"
              preload="metadata"
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
