/**
 * Phase 1 — 마스크 인지 색매칭 (color harmonization).
 *
 * 생성 결과의 평균 컬러를 카탈로그 마스터의 평균 컬러에 가깝게 끌어당겨
 * "한 카메라로 찍은 한 장" 느낌을 만든다. 두 단계:
 *
 *   1. 생성 이미지의 RGB 평균 추출 (sharp .stats)
 *   2. (옵션) birefnet 으로 foreground 마스크 추출
 *   3. sharp .linear() 로 채널별 게인/오프셋 계산해 적용
 *      - 마스크 있으면: background 강하게(0.75), foreground 약하게(0.35)
 *      - 마스크 없으면: 전역 0.55 (전체적으로 중간 강도)
 *
 * 디자인 결정:
 *   - L (밝기) 채널은 건드리지 않는다 — 노출/콘트라스트 망가뜨릴 위험.
 *   - A/B (chroma) 만 카탈로그 쪽으로 끌어와 white-balance 톤 정렬.
 *   - 강도 100% 면 생성 이미지가 카탈로그 평균과 동일해져 보존성 깨짐 → 70% 캡.
 *
 * 모든 단계는 try/catch 로 감싸 실패 시 원본 통과 (finalize 깨짐 방지).
 */

import sharp from 'sharp';
import {
  submitBirefnetMask,
  getBirefnetResult,
} from '@/lib/fal/client';
import type { CatalogColorMeta } from '@/lib/snap/catalog-metadata';

export type HarmonizeMode = 'off' | 'global' | 'masked';

const VALID_MODES: readonly HarmonizeMode[] = ['off', 'global', 'masked'];

/** env SNAP_HARMONIZE_MODE 읽기. 기본 'masked' (가장 강력). */
export function getHarmonizeMode(): HarmonizeMode {
  const v = process.env.SNAP_HARMONIZE_MODE;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as HarmonizeMode;
  }
  return 'masked';
}

/** 입력 이미지의 RGB 채널 평균. */
async function rgbMean(buf: Buffer): Promise<{ r: number; g: number; b: number }> {
  const stats = await sharp(buf).stats();
  const [rCh, gCh, bCh] = stats.channels;
  return { r: rCh.mean, g: gCh.mean, b: bCh.mean };
}

/**
 * 두 채널 평균을 가중평균해 채널별 게인 산출.
 *
 * 결과 = 생성 * a + (255 * (catalog_mean / generated_mean - 1)) * b 형태로
 * 표현 가능하지만, 단순 접근: 채널별 게인 = catalog_mean / generated_mean,
 * 강도(strength)로 1.0 쪽으로 끌어당겨 부분 적용.
 *
 *   gain_applied = 1 + (gain - 1) * strength
 *
 * strength=0 → 변화 없음, strength=1 → 완전 매칭, strength=0.7 → 70%.
 */
function channelGain(
  catalogMean: number,
  generatedMean: number,
  strength: number,
): number {
  if (generatedMean <= 0.001) return 1;
  const gain = catalogMean / generatedMean;
  return 1 + (gain - 1) * strength;
}

/**
 * 전역 색매칭 (마스크 없음). 가장 빠르지만 피부톤도 함께 시프트됨.
 * 안전 strength 0.55 — 너무 강하면 얼굴이 카탈로그 톤으로 끌려감.
 */
async function harmonizeGlobal(
  srcBuf: Buffer,
  catalogMeta: CatalogColorMeta,
  strength = 0.55,
): Promise<Buffer> {
  const gen = await rgbMean(srcBuf);
  // L (밝기) 보존을 위해 채널별 게인을 평균 밝기 보정으로 정규화.
  // 카탈로그/생성의 전체 luminance ratio 가 1 에서 멀면 단순 곱 시 어두워짐/밝아짐.
  // → 평균 luminance 가 같아지도록 정규화 후 chroma 만 시프트.
  const lumCat = 0.299 * catalogMeta.avgRgb.r + 0.587 * catalogMeta.avgRgb.g + 0.114 * catalogMeta.avgRgb.b;
  const lumGen = 0.299 * gen.r + 0.587 * gen.g + 0.114 * gen.b;
  const lumScale = lumGen > 0.001 ? lumCat / lumGen : 1;

  // luminance 가 같아지도록 정규화된 카탈로그 평균.
  const normCat = {
    r: catalogMeta.avgRgb.r / lumScale,
    g: catalogMeta.avgRgb.g / lumScale,
    b: catalogMeta.avgRgb.b / lumScale,
  };

  const aR = channelGain(normCat.r, gen.r, strength);
  const aG = channelGain(normCat.g, gen.g, strength);
  const aB = channelGain(normCat.b, gen.b, strength);

  // sharp .linear(a, b) → output = a*input + b. 채널별 게인 = a, offset 0.
  return await sharp(srcBuf)
    .linear([aR, aG, aB], [0, 0, 0])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * 마스크 기반 색매칭 — 가장 강력.
 *
 * 1) birefnet 으로 foreground 마스크 받기
 * 2) 강한 색매칭본(strength=0.75) 과 약한 색매칭본(strength=0.30) 두 개 생성
 * 3) 마스크를 알파로 써서 합성:
 *      foreground 영역 → 약한 매칭 (피부 톤 보호)
 *      background 영역 → 강한 매칭 (씬 톤 일치)
 *
 * 실패 시 global 폴백.
 */
async function harmonizeMasked(
  srcUrl: string,
  srcBuf: Buffer,
  catalogMeta: CatalogColorMeta,
): Promise<Buffer> {
  // 1) 마스크 받기. 실패하면 global 폴백.
  let maskUrl: string;
  try {
    const reqId = await submitBirefnetMask({ imageUrl: srcUrl });
    // birefnet 은 보통 3~6초. 결과는 즉시 결과 호출이 안 될 수 있어 poll 안 함 —
    // fal.queue.result 가 내부적으로 wait 처리.
    maskUrl = await getBirefnetResult(reqId);
  } catch (e) {
    console.warn('[harmonize] birefnet failed, falling back to global', e);
    return harmonizeGlobal(srcBuf, catalogMeta, 0.55);
  }

  const maskRes = await fetch(maskUrl);
  if (!maskRes.ok) {
    console.warn('[harmonize] mask fetch failed, falling back to global');
    return harmonizeGlobal(srcBuf, catalogMeta, 0.55);
  }
  const maskBuf = Buffer.from(await maskRes.arrayBuffer());

  // 2) 두 강도의 색매칭본.
  const strongBuf = await harmonizeGlobal(srcBuf, catalogMeta, 0.75);
  const weakBuf = await harmonizeGlobal(srcBuf, catalogMeta, 0.3);

  // 3) 마스크 합성.
  //    base = strong (background 강하게)
  //    overlay = weak (foreground 약하게) — mask 가 alpha (foreground=255, bg=0)
  //    결과: where mask=255, weak ; where mask=0, strong. 부드러운 경계는 mask 의 회색 단계.
  //
  // sharp 의 composite 는 overlay 의 alpha 채널을 그대로 사용. mask 를 weak 의 alpha
  // 로 붙여 base(strong) 위에 올린다.

  // 원본 사이즈 맞춰 mask 리사이즈 (birefnet 출력이 다른 사이즈일 수 있음).
  const meta = await sharp(srcBuf).metadata();
  if (!meta.width || !meta.height) {
    return strongBuf; // 메타데이터 없으면 강한 매칭만 적용.
  }

  const alphaMask = await sharp(maskBuf)
    .resize(meta.width, meta.height)
    .grayscale()
    .toColourspace('b-w')
    .toBuffer();

  // weak 에 mask 를 alpha 로 붙임.
  const weakWithAlpha = await sharp(weakBuf)
    .ensureAlpha()
    .joinChannel(alphaMask)
    .toBuffer();

  return await sharp(strongBuf)
    .composite([{ input: weakWithAlpha, blend: 'over' }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * 메인 진입점. URL → 색매칭된 Buffer.
 *
 * mode='off' → 원본 buffer 그대로 반환
 * mode='global' → 마스크 없이 전역 색매칭 (0.55 strength)
 * mode='masked' → birefnet 마스크 기반 분할 색매칭 (가장 강력)
 *
 * catalogMeta 없거나 추출 실패 → 색매칭 skip, 원본 반환 (graceful).
 */
export async function applyHarmonize(
  sourceUrl: string,
  srcBuf: Buffer,
  catalogMeta: CatalogColorMeta | null,
  mode: HarmonizeMode,
): Promise<Buffer> {
  if (mode === 'off' || !catalogMeta) return srcBuf;
  try {
    if (mode === 'global') {
      return await harmonizeGlobal(srcBuf, catalogMeta, 0.55);
    }
    return await harmonizeMasked(sourceUrl, srcBuf, catalogMeta);
  } catch (e) {
    console.warn('[harmonize] failed, returning original', e);
    return srcBuf;
  }
}
