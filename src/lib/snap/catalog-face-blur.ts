/**
 * 카탈로그 마스터 얼굴 영역 사전 마스킹 — Phase C 토글 (SNAP_CATALOG_FACE_BLUR).
 *
 * 목적: gpt-image-2 가 catalog master 의 얼굴 특징을 우리 인물 얼굴 합성에
 * 끼워넣어 identity drift 가 발생하는 문제. catalog master 의 얼굴 영역을
 * 미리 처리해 모델이 "여기 사람 있음" 만 파악하고 얼굴 디테일은
 * anchor/selfie 진본에서만 받게 한다.
 *
 * 마스킹 모드 (env SNAP_CATALOG_FACE_BLUR):
 *   - 'off'         : 마스킹 안 함 (얼굴 그대로)
 *   - 'on' / 'blur' : Gaussian blur sigma=35 (legacy default — 얼굴 형태 유지)
 *   - 'blur-strong' : Gaussian blur sigma=100 (디테일 거의 제거, 형태만)
 *   - 'solid'       : 중간 회색 (#888) solid fill (얼굴 영역 완전 차단)
 *
 * 'on' 은 legacy 호환 — 신규 코드는 'blur' 권장. 'blur-strong' / 'solid' 는
 * AI 카탈로그 마스터에서 prior leak 강한 케이스 대응. catalog reference 의
 * 다른 신호 (anchor + selfie URL) 가 충분히 "여기 사람 있다" 알려주므로
 * solid 도 안전한 옵션.
 *
 * 흐름:
 *   1) catalog.ts 의 SnapCatalogItem.faceMaskRegions 에서 좌표 읽기 (0~1 정규화).
 *   2) sharp 로 master 이미지 읽어 각 region 에 모드별 마스킹 적용.
 *   3) 결과를 public-images/wedding-snap/catalog-blurred/ 에 임시 업로드.
 *   4) 같은 catalog 재사용 시 in-memory 캐시 hit. mode 가 캐시 키에 포함되어
 *      mode 변경 후 cold start 까지는 mode 별로 독립 캐싱.
 *
 * env 토글 'off' 면 이 모듈 호출 안 함 (generate route 가 분기).
 */

import sharp from 'sharp';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';
import { findSnapCatalog, type SnapCatalogItem } from '@/lib/snap/catalog';

export type CatalogFaceBlurMode = 'off' | 'on' | 'blur' | 'blur-strong' | 'solid';

const VALID_MODES: readonly CatalogFaceBlurMode[] = [
  'off',
  'on',
  'blur',
  'blur-strong',
  'solid',
];

/**
 * env SNAP_CATALOG_FACE_BLUR 읽기. 기본 'on' (= blur, legacy 호환).
 * 'on' 과 'blur' 는 동일 동작.
 */
export function getCatalogFaceBlurMode(): CatalogFaceBlurMode {
  const v = process.env.SNAP_CATALOG_FACE_BLUR;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as CatalogFaceBlurMode;
  }
  return 'on';
}

/**
 * mode 가 마스킹 동작인지 (off 외) 여부. generate route 의 분기 단순화용.
 */
export function isCatalogFaceMaskEnabled(mode: CatalogFaceBlurMode): boolean {
  return mode !== 'off';
}

/** Vercel function instance 메모리 캐시. key = catalog id + mode. */
const maskedUrlCache = new Map<string, string>();

/**
 * 카탈로그 마스터의 얼굴 영역을 모드별로 마스킹한 버전을 반환.
 *
 *   - faceMaskRegions 가 없거나 빈 배열이면 캐싱 / 처리 모두 skip, 원본 URL 그대로 반환.
 *   - 처음 호출 시: sharp 처리 → public-images 업로드 → 캐시. ~150~300ms 소요.
 *   - 이후 호출: 캐시 hit, ~0ms.
 *
 * 실패 시 원본 URL 폴백 (silent) — 본 흐름 차단 X.
 *
 * @param catalogId       catalog item id
 * @param originalUrl     gen 라우트가 만든 절대 URL (예: `${origin}${item.image}`)
 *                        모델/fal 에 직접 넘기는 형태와 동일해야 함.
 * @param mode            마스킹 모드 (env 또는 caller 지정).
 */
export async function getBlurredCatalogUrl(
  catalogId: string,
  originalUrl: string,
  mode: CatalogFaceBlurMode = 'blur',
): Promise<string> {
  if (mode === 'off') return originalUrl;

  const cacheKey = `${catalogId}::${mode}`;
  const cached = maskedUrlCache.get(cacheKey);
  if (cached) return cached;

  const item = findSnapCatalog(catalogId);
  if (!item) return originalUrl;
  const regions = item.faceMaskRegions;
  if (!regions || regions.length === 0) {
    // 좌표 미정 → 원본 그대로.
    return originalUrl;
  }

  try {
    const buf = await loadCatalogMasterBuffer(item);
    if (!buf) return originalUrl;
    const masked = await applyRegionMask(buf, regions, mode);
    const url = await uploadMaskedVariant(catalogId, mode, masked);
    maskedUrlCache.set(cacheKey, url);
    return url;
  } catch (e) {
    console.warn(`[catalog-face-blur] failed for ${catalogId} (${mode}), using original`, e);
    return originalUrl;
  }
}

/**
 * catalog master 를 buffer 로 로드. public/ 아래 정적 자산이라 파일시스템에서 직접.
 * 빌드/배포 환경에 따라 경로가 다를 수 있어 fallback fetch 도 가능하지만
 * Vercel Next.js 환경에선 process.cwd()/public 으로 안정적 접근.
 */
async function loadCatalogMasterBuffer(item: SnapCatalogItem): Promise<Buffer | null> {
  const rel = item.image.startsWith('/') ? item.image.slice(1) : item.image;
  const abs = path.join(process.cwd(), 'public', rel);
  try {
    return await sharp(abs).toBuffer();
  } catch (e) {
    console.warn('[catalog-face-blur] read failed', abs, e);
    return null;
  }
}

/**
 * regions 의 각 사각형에 모드별 마스킹 적용. 외곽은 원본 유지.
 *
 * 'blur' / 'blur-strong': 같은 이미지를 sigma=35/100 으로 fully blur 한 별도
 *   layer 를 만들고 region 마스크로 합성.
 * 'solid': 회색 (#888) 으로 region 영역 채움.
 */
async function applyRegionMask(
  buf: Buffer,
  regions: readonly (readonly [number, number, number, number])[],
  mode: 'on' | 'blur' | 'blur-strong' | 'solid',
): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return buf;

  const sigma = mode === 'blur-strong' ? 100 : 35;
  // 'blur' / 'on' / 'blur-strong' 은 같은 합성 흐름, sigma 만 다름.
  // 'solid' 는 회색 patch 직접 생성.
  const composites: sharp.OverlayOptions[] = [];

  if (mode === 'solid') {
    for (const [x, y, w, h] of regions) {
      const left = Math.round(x * W);
      const top = Math.round(y * H);
      const width = Math.max(1, Math.round(w * W));
      const height = Math.max(1, Math.round(h * H));
      const safeWidth = Math.min(width, W - left);
      const safeHeight = Math.min(height, H - top);
      if (safeWidth <= 0 || safeHeight <= 0) continue;
      // 중간 회색 patch — 모델이 "skin tone" 으로 오해할 위험 없는 중성 색.
      const tile = await sharp({
        create: {
          width: safeWidth,
          height: safeHeight,
          channels: 3,
          background: { r: 136, g: 136, b: 136 },
        },
      })
        .jpeg()
        .toBuffer();
      composites.push({ input: tile, left, top });
    }
  } else {
    const blurredFull = await sharp(buf).blur(sigma).toBuffer();
    for (const [x, y, w, h] of regions) {
      const left = Math.round(x * W);
      const top = Math.round(y * H);
      const width = Math.max(1, Math.round(w * W));
      const height = Math.max(1, Math.round(h * H));
      const safeWidth = Math.min(width, W - left);
      const safeHeight = Math.min(height, H - top);
      if (safeWidth <= 0 || safeHeight <= 0) continue;
      const tile = await sharp(blurredFull)
        .extract({ left, top, width: safeWidth, height: safeHeight })
        .toBuffer();
      composites.push({ input: tile, left, top });
    }
  }

  if (composites.length === 0) return buf;

  return await sharp(buf)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * 마스킹 된 buffer 를 public-images/wedding-snap/catalog-blurred/ 에 업로드 후
 * 공개 URL 반환. mode 가 path 에 포함돼 mode 변경 후에도 충돌 없음.
 * 캐시 무효화는 catalog id + mode 끝에 fingerprint 붙여 처리.
 */
async function uploadMaskedVariant(
  catalogId: string,
  mode: CatalogFaceBlurMode,
  buf: Buffer,
): Promise<string> {
  const admin = createAdminClient();
  const path = `wedding-snap/catalog-blurred/${catalogId}-${mode}-${Date.now()}.jpg`;
  const { error } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`masked upload: ${error.message}`);
  return admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
}

/** 테스트 / 캐시 워밍업 용 — instance 메모리만 비움. */
export function clearCatalogBlurCache(): void {
  maskedUrlCache.clear();
}
