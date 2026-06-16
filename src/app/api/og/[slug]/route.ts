import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase/admin';
import { THEME_PALETTES, type ColorTheme } from '@/lib/theme';

/**
 * 알림장 공유(OG) 이미지 동적 생성 — 표지 사진이 없는 일러스트/텍스트 표지용.
 *
 * "표지 화면처럼": 테마 배경색 위에 표지 일러스트(PNG)를 합성한다. 텍스트는 넣지
 * 않는다(폰트 불필요). 일러스트 PNG 는 public/illustrations/ 의 정적 파일을
 * sharp 로 디스크에서 직접 읽어 합성한다 — Satori 의 self-fetch(자기 도메인에서
 * 이미지 가져오기) 실패로 일러스트가 안 그려지고 배경만 나오던 문제를 피한다.
 *
 * text-flower 는 라인 스케치(어두운 선)라 다크 배경에선 안 보이므로, 배경이 어두울
 * 때만 색을 반전(negate)해 표지와 동일하게 보이게 한다. illust-*(풀컬러)는 반전 없음.
 *
 * 크롤러(카카오톡 등)가 공유 시점에만 호출 + 캐시 → 사용자 성능 영향 없음.
 */
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 630;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return { r: 250, g: 247, b: 242 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// 상대 휘도 (0=검정 ~ 1=흰색). 0.4 미만이면 어두운 배경으로 본다.
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  let bgHex = '#FAF7F2';
  let illustFile: string | null = null;

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
      bgHex = THEME_PALETTES[colorTheme].bg;
    }
    const main = content?.main ?? {};
    if (main.layout === 'illustration') {
      illustFile = `illust-${main.illustrationDesign?.variant ?? 'arch'}.png`;
    } else if (main.layout === 'text') {
      const v = main.textDesign?.variant ?? 'flower';
      if (v !== 'none') illustFile = `text-${v}.png`;
    }
  } catch {
    // 조회 실패 → 테마 기본 배경만.
  }

  const bg = hexToRgb(bgHex);
  const darkBg = luminance(bg) < 0.4;

  try {
    let canvas = sharp({
      create: { width: W, height: H, channels: 4, background: { ...bg, alpha: 1 } },
    });

    if (illustFile) {
      const fp = path.join(process.cwd(), 'public', 'illustrations', illustFile);
      if (fs.existsSync(fp)) {
        let img = sharp(fp).resize({
          width: 760,
          height: 540,
          fit: 'inside',
          withoutEnlargement: false,
        });
        // 라인 스케치(text-flower)만 다크 배경에서 반전 → 밝은 선으로.
        if (darkBg && illustFile === 'text-flower.png') {
          img = img.negate({ alpha: false });
        }
        const illustBuf = await img.png().toBuffer();
        canvas = canvas.composite([{ input: illustBuf, gravity: 'center' }]);
      }
    }

    const out = await canvas.png().toBuffer();
    return new NextResponse(new Uint8Array(out), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    // sharp 실패 시에도 OG 가 깨지지 않도록 단색 배경 PNG 로 폴백.
    const px = await sharp({
      create: { width: W, height: H, channels: 4, background: { ...bg, alpha: 1 } },
    })
      .png()
      .toBuffer();
    return new NextResponse(new Uint8Array(px), {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=600' },
    });
  }
}
