import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
import { THEME_PALETTES, type ColorTheme } from '@/lib/theme';

/**
 * 알림장 공유(OG) 이미지 동적 생성 — 표지 사진이 없는 일러스트/텍스트 표지용.
 *
 * "표지 화면처럼": 테마 배경색 + 표지 일러스트(PNG)만 그린다. (텍스트는 넣지
 * 않으므로 한글 폰트 불필요 → Satori woff2 제약과 무관.) 표지 사진이 있는
 * 알림장은 /[slug] 의 generateMetadata 가 그 사진 URL 을 직접 OG 로 쓰므로 이
 * 라우트를 거치지 않는다.
 *
 * 크롤러(카카오톡 등)가 공유 시점에만 호출 + 캐시되므로 사용자 성능 영향 없음.
 */
export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://wooridaun.com';
const SIZE = { width: 1200, height: 630 };

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  let bg = '#FAF7F2';
  let illustUrl: string | null = null;

  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from('publications')
      .select('content')
      .eq('slug', params.slug)
      .maybeSingle();
    const content = (data?.content ?? null) as {
      theme?: { colorTheme?: ColorTheme };
      main?: {
        layout?: string;
        illustrationDesign?: { variant?: string };
        textDesign?: { variant?: string };
      };
    } | null;

    const colorTheme = content?.theme?.colorTheme;
    if (colorTheme && THEME_PALETTES[colorTheme]) {
      bg = THEME_PALETTES[colorTheme].bg;
    }
    const main = content?.main ?? {};
    if (main.layout === 'illustration') {
      illustUrl = `${BASE}/illustrations/illust-${main.illustrationDesign?.variant ?? 'arch'}.png`;
    } else if (main.layout === 'text') {
      const v = main.textDesign?.variant ?? 'flower';
      if (v !== 'none') illustUrl = `${BASE}/illustrations/text-${v}.png`;
    }
  } catch {
    // 조회 실패 시 테마 기본 배경만 — OG 가 깨지지 않도록 안전 폴백.
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
        }}
      >
        {illustUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={illustUrl}
            width={560}
            height={560}
            style={{ objectFit: 'contain' }}
            alt=""
          />
        ) : null}
      </div>
    ),
    SIZE,
  );
}
