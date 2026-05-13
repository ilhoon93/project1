/**
 * 카탈로그 결과 후처리 — 업스케일 + sharpen 체인.
 *
 * 사용자 피드백 (aura-sr 4x 단독은 "화질이 비슷"):
 *   - generic super-res 는 픽셀만 늘리고 detail 못 만듦
 *   - 해결: detail enhancer (Topaz) 또는 sharpen 후처리 보강
 *
 * 두 가지 조합을 env flag 로 토글:
 *   - 'aura-sharpen' : aura-sr 2x → sharpen.  안전 최우선, 비용 ↓
 *   - 'topaz-sharpen': Topaz 2x → sharpen.  효과 최우선, 비용 ↑
 *   - 'off'          : 후처리 없음 (기본)
 *
 * 적용 범위: 카탈로그 결과만. 앵커는 reference 라 업스케일 불필요.
 *
 * 안전:
 *   - 어떤 단계든 실패하면 try/catch 로 원본 fall back (finalize 자체는 깨지지 않음)
 *   - aura / topaz 모두 face_enhancement 끄고 호출해 identity 변형 위험 차단
 */

import sharp from 'sharp';
import {
  getAuraSrResult,
  getTopazResult,
  submitAuraSrUpscale,
  submitTopazUpscale,
} from '@/lib/fal/client';

export type UpscaleMode = 'off' | 'aura-sharpen' | 'topaz-sharpen';

const VALID_MODES: readonly UpscaleMode[] = ['off', 'aura-sharpen', 'topaz-sharpen'];

/** env 변수 SNAP_UPSCALE_MODE 읽어 검증. 잘못된 값이면 'off'. */
export function getUpscaleMode(): UpscaleMode {
  const v = process.env.SNAP_UPSCALE_MODE;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as UpscaleMode;
  }
  return 'off';
}

/**
 * 입력 URL → 후처리된 Buffer 반환.
 *
 * mode='off' 면 원본을 그대로 fetch 해 Buffer 로 변환.
 * 외 mode 는 업스케일 → sharpen 적용.
 *
 * 실패 시 throw — 호출 측에서 try/catch 로 원본 fallback 처리.
 */
export async function applyUpscalePostprocess(
  sourceUrl: string,
  mode: UpscaleMode,
): Promise<Buffer> {
  // 1. 업스케일 단계 (모드 별).
  let upscaledUrl = sourceUrl;
  if (mode === 'aura-sharpen') {
    const reqId = await submitAuraSrUpscale({ imageUrl: sourceUrl, scale: 2 });
    upscaledUrl = await getAuraSrResult(reqId);
  } else if (mode === 'topaz-sharpen') {
    const reqId = await submitTopazUpscale({
      imageUrl: sourceUrl,
      scale: 2,
      model: 'Standard V2',
    });
    upscaledUrl = await getTopazResult(reqId);
  }

  // 2. Buffer 로 fetch.
  const res = await fetch(upscaledUrl);
  if (!res.ok) throw new Error(`fetch upscaled image: ${res.status}`);
  const srcBuf = Buffer.from(await res.arrayBuffer());

  // 3. mode='off' 면 sharpen 도 skip (원본 통과).
  if (mode === 'off') return srcBuf;

  // 4. sharpen — unsharp mask. 약하게 적용해 over-sharpen 인공물 차단.
  //    sigma 1.0 = 1px radius. m1=0.5 m2=0.5 = 보수적 강도.
  //    JPEG quality 92 (mozjpeg) — 디테일 보존하면서 파일 크기 적당.
  return await sharp(srcBuf)
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 0.5 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * 단순 fetch → Buffer. mode='off' 일 때 finalize 가 호출.
 * applyUpscalePostprocess 와 동일 동작이지만 별도 함수로 둬서 호출 측 명확성 ↑.
 */
export async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
