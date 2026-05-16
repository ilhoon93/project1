/**
 * 카탈로그 마스터 얼굴 영역 사전 blur — Phase C 토글 (SNAP_CATALOG_FACE_BLUR).
 *
 * 목적: gpt-image-2 가 catalog master 의 얼굴 특징을 우리 인물 얼굴 합성에
 * 끼워넣어 identity drift 가 발생하는 문제. catalog master 의 얼굴 영역을
 * 미리 강하게 blur 처리해 모델이 "여기 사람 있음" 만 파악하고 얼굴 디테일은
 * anchor/selfie 진본에서만 받게 한다.
 *
 * 흐름:
 *   1) catalog.ts 의 SnapCatalogItem.faceMaskRegions 에서 좌표 읽기 (0~1 정규화).
 *   2) sharp 로 master 이미지 읽어 각 region 에 Gaussian blur (sigma 35) 적용.
 *      형태 보존을 위해 region 만 blur, 외곽은 그대로.
 *   3) 결과를 public-images/wedding-snap/catalog-blurred/ 에 임시 업로드.
 *   4) 같은 catalog 재사용 시 in-memory 캐시 hit → 추가 sharp / 업로드 비용 0.
 *      Vercel function instance lifetime 동안 유지. 콜드 스타트 시 재처리.
 *
 * env 토글 'off' 면 이 모듈 호출 안 함 (generate route 가 분기).
 */

import sharp from 'sharp';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';
import { findSnapCatalog, type SnapCatalogItem } from '@/lib/snap/catalog';

export type CatalogFaceBlurMode = 'off' | 'on';

const VALID_MODES: readonly CatalogFaceBlurMode[] = ['off', 'on'];

/** env SNAP_CATALOG_FACE_BLUR 읽기. 기본 'off'. */
export function getCatalogFaceBlurMode(): CatalogFaceBlurMode {
  const v = process.env.SNAP_CATALOG_FACE_BLUR;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as CatalogFaceBlurMode;
  }
  return 'off';
}

/** Vercel function instance 메모리 캐시. key = catalog id, value = public URL. */
const blurredUrlCache = new Map<string, string>();

/**
 * 카탈로그 마스터의 얼굴 영역을 blur 한 버전을 반환.
 *
 *   - faceMaskRegions 가 없거나 빈 배열이면 캐싱 / blur 모두 skip, 원본 URL 그대로 반환.
 *   - 처음 호출 시: sharp blur → public-images 업로드 → 캐시. ~150~300ms 소요.
 *   - 이후 호출: 캐시 hit, ~0ms.
 *
 * 실패 시 원본 URL 폴백 (silent) — 본 흐름 차단 X.
 *
 * @param catalogId       catalog item id
 * @param originalUrl     gen 라우트가 만든 절대 URL (예: `${origin}${item.image}`)
 *                        모델/fal 에 직접 넘기는 형태와 동일해야 함.
 */
export async function getBlurredCatalogUrl(
  catalogId: string,
  originalUrl: string,
): Promise<string> {
  const cached = blurredUrlCache.get(catalogId);
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
    const blurred = await applyRegionBlur(buf, regions);
    const url = await uploadBlurredVariant(catalogId, blurred);
    blurredUrlCache.set(catalogId, url);
    return url;
  } catch (e) {
    console.warn(`[catalog-face-blur] failed for ${catalogId}, using original`, e);
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
 * regions 의 각 사각형에 강한 Gaussian blur 적용. 외곽은 원본 유지.
 *
 * 구현: 같은 이미지를 sigma=35 로 fully blur 한 별도 layer 를 만들고, region
 * 마스크로 합성. region 안쪽은 blurred, 바깥은 original.
 */
async function applyRegionBlur(
  buf: Buffer,
  regions: readonly (readonly [number, number, number, number])[],
): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return buf;

  // 1) 완전히 blur 된 layer.
  const blurredFull = await sharp(buf).blur(35).toBuffer();

  // 2) 각 region 만 잘라내 원본 위에 덮어쓰기. composite 가 가장 단순한 구현.
  const composites: sharp.OverlayOptions[] = [];
  for (const [x, y, w, h] of regions) {
    const left = Math.round(x * W);
    const top = Math.round(y * H);
    const width = Math.max(1, Math.round(w * W));
    const height = Math.max(1, Math.round(h * H));
    const safeWidth = Math.min(width, W - left);
    const safeHeight = Math.min(height, H - top);
    if (safeWidth <= 0 || safeHeight <= 0) continue;
    // blurredFull 에서 같은 영역 crop.
    const tile = await sharp(blurredFull)
      .extract({ left, top, width: safeWidth, height: safeHeight })
      .toBuffer();
    composites.push({ input: tile, left, top });
  }

  if (composites.length === 0) return buf;

  return await sharp(buf)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * blur 된 buffer 를 public-images/wedding-snap/catalog-blurred/ 에 업로드 후
 * 공개 URL 반환. 캐시 무효화는 catalog id 끝에 fingerprint 붙여 처리 (단순화
 * 위해 catalog id 만 사용 — 좌표 변경 시 코드 재배포로 함수 instance 가 새로
 * 생기므로 cold start 때 새로 만들어진다).
 */
async function uploadBlurredVariant(catalogId: string, buf: Buffer): Promise<string> {
  const admin = createAdminClient();
  const path = `wedding-snap/catalog-blurred/${catalogId}-${Date.now()}.jpg`;
  const { error } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`blurred upload: ${error.message}`);
  return admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
}

/** 테스트 / 캐시 워밍업 용 — instance 메모리만 비움. */
export function clearCatalogBlurCache(): void {
  blurredUrlCache.clear();
}
