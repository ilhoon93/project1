import imageCompression from 'browser-image-compression';
import { IMAGE_LIMITS, formatBytes } from './limits';

export type ImageValidationResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

/**
 * MIME / 원본 용량 검증. 통과 시 동일 File 그대로 반환.
 *
 * 압축은 별도 단계 (compressImage) — 큰 원본을 메모리에 올리기 전에
 * "용량부터 거절" 할 수 있게 압축과 분리한다.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!IMAGE_LIMITS.acceptMime.includes(file.type as (typeof IMAGE_LIMITS.acceptMime)[number])) {
    return {
      ok: false,
      message: `${IMAGE_LIMITS.acceptExtLabel} 형식만 지원됩니다.`,
    };
  }
  if (file.size > IMAGE_LIMITS.maxInputBytes) {
    return {
      ok: false,
      message: `이미지 크기는 ${formatBytes(IMAGE_LIMITS.maxInputBytes)} 이하여야 합니다.`,
    };
  }
  return { ok: true, file };
}

/**
 * 이미지를 시각적 무손실에 가까운 수준으로 압축한다.
 *
 * - JPEG/WEBP: 품질 0.92 + 최대 변 2400px → 일반 폰 카메라 사진(5–10MB)이 1.5–3MB 로 줄어듦
 * - PNG: 무손실 → 압축률은 떨어지지만 알파 채널 보존. 임계값 이하면 그대로 둠.
 * - 압축 후 오히려 커지면 원본을 그대로 사용 (browser-image-compression 가 자동 처리)
 *
 * 압축 실패 시 원본 File 을 그대로 반환 — 업로드 자체는 막지 않는다.
 */
export async function compressImage(file: File): Promise<File> {
  // 이미 충분히 작은 파일은 압축 비용을 아끼고 그대로 통과.
  if (file.size <= 512 * 1024) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: IMAGE_LIMITS.targetMB,
      maxWidthOrHeight: IMAGE_LIMITS.maxDimension,
      initialQuality: IMAGE_LIMITS.initialQuality,
      useWebWorker: true,
      // 출력 MIME 은 원본 유지 — PNG/WebP 의 알파 채널, ICC 프로파일 등을 보존.
      fileType: file.type,
    });
    return compressed;
  } catch {
    return file;
  }
}
