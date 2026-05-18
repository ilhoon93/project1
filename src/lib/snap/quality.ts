/**
 * 카탈로그 / 앵커 이미지 생성 시 gpt-image-2/edit 에 넘길 quality 값.
 *
 * env SNAP_IMAGE_QUALITY:
 *   - 'low'    : ~$0.01/회, 거친 결과
 *   - 'medium' : ~$0.04/회, 인페인팅에서 충분 (현재 운영 기본)
 *   - 'high'   : ~$0.13/회, 디테일 최대 — A/B 비교 / 프리미엄 테스트용
 *   - 'auto'   : fal 측 자동 결정 (모델 정책에 위임)
 *
 * 잘못된 값이면 'medium' 으로 fallback + 한 번만 경고 로깅.
 *
 * snap_jobs.quality 컬럼에는 실제 사용된 값이 logSnapJobSubmit 시점에 기록되어
 * 비용 분석/실험 추적에 그대로 사용할 수 있다.
 */

import type { GptImageQuality } from '@/lib/fal/client';

const VALID_QUALITIES: readonly GptImageQuality[] = ['low', 'medium', 'high', 'auto'];
const DEFAULT_QUALITY: GptImageQuality = 'medium';

let warnedOnce = false;

export function getSnapImageQuality(): GptImageQuality {
  const v = process.env.SNAP_IMAGE_QUALITY;
  if (typeof v !== 'string' || v.length === 0) return DEFAULT_QUALITY;
  if ((VALID_QUALITIES as readonly string[]).includes(v)) {
    return v as GptImageQuality;
  }
  if (!warnedOnce) {
    warnedOnce = true;
    console.warn(
      `[snap/quality] invalid SNAP_IMAGE_QUALITY="${v}" — falling back to "${DEFAULT_QUALITY}". ` +
        `Valid values: ${VALID_QUALITIES.join(', ')}`,
    );
  }
  return DEFAULT_QUALITY;
}
