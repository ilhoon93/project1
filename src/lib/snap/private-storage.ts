/**
 * private-uploads 버킷 helper.
 *
 * 셀카·커플 사진·anchor·preprocessed·ephemeral 등 개인 식별 정보가 들어가는
 * 모든 업로드는 이 모듈로 통일. URL 노출 시에는 signed URL 사용.
 *
 * 컨벤션:
 *   - 경로 prefix 는 항상 wedding-snap/{userId}/...  또는 {userId}/...
 *     RLS 정책이 두 prefix 모두 허용 (020 migration).
 *   - 결과 이미지(generated outputs) 는 별도로 public-images 에 남김 — 사용자가
 *     외부 채널에 공유할 수 있어야 하므로 정책적 결정.
 *   - signed URL TTL 은 용도별:
 *     · fal 호출용 단기 URL: 1시간 (모델 wait 까지 충분)
 *     · DB 저장용 장기 URL (anchor): 1년 (1 년 후 갱신 필요 — 향후 별도 갱신
 *       흐름 추가 예정)
 */

import { createAdminClient } from '@/lib/supabase/admin';

const PRIVATE_BUCKET = 'private-uploads';

/** fal 호출 시 단기 (1시간) — 큐 wait 후 결과 fetch 까지 충분. */
export const SIGNED_URL_TTL_SHORT = 60 * 60;
/** anchor 같이 DB 에 저장되어 반복 사용 (1년) — 만료 직전 갱신 흐름 필요. */
export const SIGNED_URL_TTL_LONG = 60 * 60 * 24 * 365;

export interface PrivateUploadResult {
  /** 버킷 내 경로. DB 에 저장하면 signed URL 재발급 가능. */
  path: string;
  /** 즉시 사용 가능한 signed URL. */
  signedUrl: string;
}

/**
 * Buffer 또는 Blob 을 private-uploads 에 업로드 + signed URL 반환.
 *
 * @param path  버킷 내 경로 (wedding-snap/{userId}/... 권장)
 * @param body  파일 내용
 * @param ttlSeconds  signed URL TTL (기본 1시간)
 */
export async function uploadPrivate(
  path: string,
  body: Buffer | Blob,
  contentType: string,
  ttlSeconds: number = SIGNED_URL_TTL_SHORT,
): Promise<PrivateUploadResult> {
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(PRIVATE_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (upErr) throw new Error(`private upload failed: ${upErr.message}`);

  const signedUrl = await createPrivateSignedUrl(path, ttlSeconds);
  return { path, signedUrl };
}

/**
 * 기존 path 에서 signed URL 생성. 갱신 흐름에 사용.
 */
export async function createPrivateSignedUrl(
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SHORT,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) {
    throw new Error(`signed URL creation failed: ${error?.message ?? 'no data'}`);
  }
  return data.signedUrl;
}

/**
 * 여러 path 의 signed URL 을 한 번에 생성. mypage 등 갤러리용.
 * 일부 실패해도 다른 URL 은 반환 (null 자리 표시).
 */
export async function createPrivateSignedUrlsBulk(
  paths: string[],
  ttlSeconds: number = SIGNED_URL_TTL_SHORT,
): Promise<Array<string | null>> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrls(paths, ttlSeconds);
  if (error || !data) {
    console.warn('[private-storage] bulk signed URLs failed', error);
    return paths.map(() => null);
  }
  return data.map((d) => d.signedUrl ?? null);
}

/**
 * supabase private-uploads signed URL 패턴을 인식해 path 를 추출 → 새 signed
 * URL 발급. fal 호출 직전에 항상 호출해 만료된 long-TTL URL (anchor/selfie 등)
 * 을 즉시 갱신.
 *
 * 입력이 supabase signed URL 패턴이 아니면 (예: public-images 의 publicUrl 또는
 * fal 외부 URL) 원본 그대로 반환. 추출/재발급 실패도 silent fallback — 후속
 * HEAD precheck 가 잡아 명확한 메시지로 surface.
 */
const PRIVATE_SIGNED_PATH_PREFIX = `/storage/v1/object/sign/${PRIVATE_BUCKET}/`;

export async function refreshPrivateSignedUrl(
  url: string,
  ttlSeconds: number = SIGNED_URL_TTL_SHORT,
): Promise<string> {
  try {
    const parsed = new URL(url);
    const idx = parsed.pathname.indexOf(PRIVATE_SIGNED_PATH_PREFIX);
    if (idx < 0) return url;
    const path = parsed.pathname.slice(idx + PRIVATE_SIGNED_PATH_PREFIX.length);
    if (!path) return url;
    return await createPrivateSignedUrl(decodeURIComponent(path), ttlSeconds);
  } catch (e) {
    console.warn('[private-storage] refresh failed, using original', url, e);
    return url;
  }
}
