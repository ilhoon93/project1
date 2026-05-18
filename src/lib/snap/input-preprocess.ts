/**
 * 입력 이미지 선처리 — 결과 품질에 영향 없는 보수적 작업만.
 *
 * 적용 범위:
 *   1) EXIF auto-rotate — 메타데이터 기반 회전 보정 (iPhone 가로 사진이 세로로
 *      잘못 표시되는 문제 해결). 픽셀 손실 0.
 *   2) HEIC → JPEG 변환 — sharp 가 자동 처리. fal 호환성 확보.
 *   3) 약한 화이트밸런스 (sharp .normalise()) — 채널별 stretch 만, 색 그레이딩
 *      안 함. 입력이 강하게 컬러캐스트 됐을 때만 효과, 정상 사진엔 변화 미미.
 *
 * 추후 도입 가능 (별도 PR):
 *   - 얼굴 중심 크롭 — face detection 필요. 입력이 광각이고 얼굴이 작을 때 효과
 *     있지만, 셀카는 보통 얼굴이 중앙에 있어 비용 대비 효과 작음.
 *   - 저해상도 업스케일 — 입력 < 800px 일 때만. 본 PR 의 validation 단계가
 *     1000px 미만을 reject 하므로 일반적으론 불필요.
 *
 * 안전 원칙: 어떤 단계도 강하게 적용 안 함. 결과 품질 영향 ≈ 0 또는 미세하게 +.
 */

import sharp from 'sharp';
import { uploadPrivate } from '@/lib/snap/private-storage';

export interface PreprocessOptions {
  /** false 면 화이트밸런스 정규화도 skip. 기본 true. */
  normalise?: boolean;
  /** 저장 시 파일명 prefix (디버깅 / 추적용). */
  pathPrefix?: string;
  /** 업로드 경로의 user_id segment. RLS 정책상 권장. 없으면 'unknown' 사용. */
  userId?: string;
}

export interface PreprocessResult {
  /** 선처리 결과의 signed URL (단기, fal 호출용). */
  publicUrl: string;
  /** 처리 전 metadata (디버깅 용). */
  beforeMeta: { width: number; height: number; format: string | undefined };
}

/**
 * URL 받아 sharp 로 보수적 선처리 후 public-images/wedding-snap/preprocessed/
 * 에 업로드, 새 public URL 반환.
 *
 * 실패 시 throw — 호출 측이 try/catch 로 원본 URL 폴백.
 */
export async function preprocessAndUpload(
  sourceUrl: string,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const { normalise = true, pathPrefix = 'face', userId } = options;

  // 1) Fetch 원본.
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`fetch source: ${res.status}`);
  const srcBuf = Buffer.from(await res.arrayBuffer());

  const beforeMeta = await sharp(srcBuf).metadata();

  // 2) sharp 파이프라인.
  //    - rotate() : EXIF orientation 자동 보정 (인자 없이 호출하면 EXIF 따라 회전).
  //    - normalise(): RGB 각 채널을 0-255 로 stretch. 톤 보존 (색 그레이딩 X).
  //      입력이 정상 노출이면 변화 거의 0. 강한 컬러캐스트만 보정.
  //    - jpeg quality 95 + mozjpeg: 디테일 보존 + 파일 크기 적당.
  let pipeline = sharp(srcBuf).rotate(); // EXIF auto-rotate
  if (normalise) {
    pipeline = pipeline.normalise();
  }
  const outBuf = await pipeline.jpeg({ quality: 95, mozjpeg: true }).toBuffer();

  // 3) private-uploads 에 업로드 (개인 정보 격리). RLS 정책상 user_id segment 필요.
  //    userId 미지정 케이스는 'unknown' 으로 — 다만 호출 측이 항상 user.id 를
  //    넘겨야 안전. 호출 사이트 점검 후 미지정 fallback 은 제거 가능.
  const rand = Math.random().toString(36).slice(2, 8);
  const uid = userId ?? 'unknown';
  const path = `wedding-snap/${uid}/preprocessed/${pathPrefix}-${Date.now()}-${rand}.jpg`;
  const { signedUrl } = await uploadPrivate(path, outBuf, 'image/jpeg');

  return {
    publicUrl: signedUrl,
    beforeMeta: {
      width: beforeMeta.width ?? 0,
      height: beforeMeta.height ?? 0,
      format: beforeMeta.format,
    },
  };
}

/**
 * 여러 URL 을 병렬 선처리. 어느 하나라도 실패하면 그 URL 은 원본 그대로 반환
 * (silent fallback) — 입력 1개가 실패해도 전체 흐름 차단 X.
 */
export async function preprocessUrlsParallel(
  urls: string[],
  options: PreprocessOptions = {},
): Promise<string[]> {
  return await Promise.all(
    urls.map(async (url) => {
      try {
        const result = await preprocessAndUpload(url, options);
        return result.publicUrl;
      } catch (e) {
        console.warn('[input-preprocess] failed, using original URL', url, e);
        return url;
      }
    }),
  );
}
