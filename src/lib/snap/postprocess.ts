/**
 * 카탈로그 결과 후처리 — harmonize → finishing → 업스케일 → sharpen 체인.
 *
 * 톤 일관성 4단 파이프라인 (각 단계 env flag 로 토글):
 *   1. Phase 1 — harmonize     : 카탈로그 평균 컬러 매칭 (마스크 인지)   [SNAP_HARMONIZE_MODE]
 *   2. Phase 2 — finishing     : 저강도 flux img2img 로 톤/조명 통합     [SNAP_FINISHING_MODE]
 *   3. 업스케일                 : aura-sr 또는 Topaz 업스케일              [SNAP_UPSCALE_MODE]
 *   4. sharpen                  : 로컬 unsharp mask (업스케일 ON 일 때만)
 *
 * 적용 범위: 카탈로그 결과만. 앵커는 reference 라 후처리 전체 skip.
 *
 * 안전: 각 단계가 try/catch — 어느 단계든 실패하면 직전 결과로 fallback,
 * 마지막엔 항상 최선의 결과 Buffer 가 나온다. 전부 실패해도 원본 fetch 폴백.
 *
 * URL/Buffer 상태 관리: fal 모델은 URL 만, sharp 는 Buffer 만 받기 때문에 단계 간
 * 변환이 필요. PipelineState 가 currentUrl / currentBuf 중 어느 쪽이 최신인지 추적,
 * 다음 단계가 요구하는 형식으로 lazy 변환한다.
 */

import sharp from 'sharp';
import {
  getAuraSrResult,
  getTopazResult,
  submitAuraSrUpscale,
  submitTopazUpscale,
} from '@/lib/fal/client';
import { getCatalogColorMeta } from '@/lib/snap/catalog-metadata';
import { applyHarmonize, getHarmonizeMode } from '@/lib/snap/harmonize';
import { applyFinishing, getFinishingMode } from '@/lib/snap/finishing';

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
 * 파이프라인 단계 간 결과 상태. 둘 중 정확히 한쪽이 최신.
 * - currentBuf 있으면: 로컬 변환 후라 buffer 만 신뢰 가능 (URL 은 이전 단계 가리킴)
 * - currentBuf 없으면: 원격 URL 이 최신, 필요할 때 lazy fetch
 */
interface PipelineState {
  /** 항상 valid — 원본 fal 결과 URL. birefnet mask 추출용으로 보존. */
  readonly sourceUrl: string;
  /** 가장 최근 fal 결과 URL (finishing/upscale 이 갱신). null 이면 currentBuf 가 최신. */
  currentUrl: string | null;
  /** 가장 최근 로컬 변환 결과 buffer. null 이면 currentUrl 이 최신. */
  currentBuf: Buffer | null;
  catalogId?: string | null;
}

async function ensureBuf(state: PipelineState): Promise<Buffer> {
  if (state.currentBuf) return state.currentBuf;
  const url = state.currentUrl ?? state.sourceUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ensureUrl(state: PipelineState): Promise<string> {
  if (state.currentUrl) return state.currentUrl;
  if (!state.currentBuf) return state.sourceUrl;
  // buf 만 있으면 fal 에 넘기기 위해 임시 storage 업로드.
  return uploadEphemeralForFal(state.currentBuf, state.catalogId ?? null);
}

/**
 * harmonize buffer 를 finishing(fal) 에 넘기기 위해 임시 supabase storage 에 업로드.
 * fal img2img 가 image_url 만 받고 base64 / inline data 미지원이라 이 우회가 필요.
 * public-images/wedding-snap/ephemeral/ 경로에 업로드. 별도 cron 으로 정리 가능.
 */
async function uploadEphemeralForFal(
  buf: Buffer,
  catalogId: string | null,
): Promise<string> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const slug = catalogId ? `${catalogId}-` : '';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `wedding-snap/ephemeral/${slug}${Date.now()}-${rand}.jpg`;
  const { error } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`ephemeral upload failed: ${error.message}`);
  return admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
}

/**
 * 카탈로그 결과 전체 후처리 파이프라인.
 *
 * mode='off' 이면 upscale/sharpen 은 skip 되지만 harmonize/finishing 은 자체 env
 * flag 로 독립 동작 — 모든 단계가 OFF 인 경우엔 단순히 fetch 만 수행.
 *
 * 실패 시 throw — 호출 측(finalize) 이 try/catch 로 원본 fallback 처리.
 */
export async function applyUpscalePostprocess(
  sourceUrl: string,
  mode: UpscaleMode,
  catalogId?: string | null,
): Promise<Buffer> {
  const catalogMeta = catalogId ? await getCatalogColorMeta(catalogId) : null;

  const state: PipelineState = {
    sourceUrl,
    currentUrl: sourceUrl,
    currentBuf: null,
    catalogId,
  };

  // ── 1. Harmonize (Phase 1) ───────────────────────────────────
  // 카탈로그 메타가 있어야 동작. 마스크 모드는 sourceUrl 기준으로 birefnet 호출.
  const harmonizeMode = getHarmonizeMode();
  if (harmonizeMode !== 'off' && catalogMeta) {
    try {
      const inputBuf = await ensureBuf(state);
      const harmonized = await applyHarmonize(
        state.sourceUrl,
        inputBuf,
        catalogMeta,
        harmonizeMode,
      );
      state.currentBuf = harmonized;
      state.currentUrl = null; // buffer 가 최신.
    } catch (e) {
      console.warn('[postprocess] harmonize failed, continuing', e);
    }
  }

  // ── 2. Finishing (Phase 2) ───────────────────────────────────
  // flux img2img — strength 0.2 로 톤/조명 통합. URL 필요해 buf 있으면 ephemeral 업로드.
  const finishingMode = getFinishingMode();
  if (finishingMode === 'img2img') {
    try {
      const inputUrl = await ensureUrl(state);
      const finishedUrl = await applyFinishing(
        inputUrl,
        catalogId,
        catalogMeta,
        finishingMode,
      );
      if (finishedUrl) {
        state.currentUrl = finishedUrl;
        state.currentBuf = null;
      }
    } catch (e) {
      console.warn('[postprocess] finishing failed, continuing', e);
    }
  }

  // ── 3. Upscale ───────────────────────────────────────────────
  if (mode === 'aura-sharpen') {
    try {
      const inputUrl = await ensureUrl(state);
      const reqId = await submitAuraSrUpscale({ imageUrl: inputUrl, scale: 2 });
      state.currentUrl = await getAuraSrResult(reqId);
      state.currentBuf = null;
    } catch (e) {
      console.warn('[postprocess] aura-sr failed, continuing without upscale', e);
    }
  } else if (mode === 'topaz-sharpen') {
    try {
      const inputUrl = await ensureUrl(state);
      const reqId = await submitTopazUpscale({
        imageUrl: inputUrl,
        scale: 2,
        model: 'Standard V2',
      });
      state.currentUrl = await getTopazResult(reqId);
      state.currentBuf = null;
    } catch (e) {
      console.warn('[postprocess] topaz failed, continuing without upscale', e);
    }
  }

  // ── 4. Sharpen + JPEG encode ─────────────────────────────────
  // 업스케일이 일어났을 때만 sharpen (no-upscale 케이스에 sharpen 적용 시 over-sharpen).
  // 어쨌든 항상 JPEG 재인코딩해 일관 포맷으로 storage 에 올린다.
  const finalBuf = await ensureBuf(state);
  const upscaled = mode === 'aura-sharpen' || mode === 'topaz-sharpen';
  const pipeline = sharp(finalBuf);
  if (upscaled) {
    pipeline.sharpen({ sigma: 1.0, m1: 0.5, m2: 0.5 });
  }
  return await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

/**
 * 단순 fetch → Buffer. 어떤 후처리도 적용 안 하고 원본만 가져올 때 사용.
 * 카탈로그 결과 finalize 에서 모든 단계가 'off' 일 때 호출 가능.
 */
export async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
