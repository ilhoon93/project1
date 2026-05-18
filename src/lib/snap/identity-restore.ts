/**
 * Phase B 토글 — catalog 결과의 얼굴 identity 복원.
 *
 * env SNAP_IDENTITY_MODE 값:
 *   - 'off'       : 비활성 (Phase A 만)
 *   - 'face-swap' : catalog 생성 결과에 face swap 후처리. 카탈로그 구도/의상/배경
 *                   그대로 유지하면서 얼굴만 selfie 진본으로 교체.
 *                   solo 1회, together 2회 swap (face_index 0=신랑, 1=신부).
 *                   비용 +$0.01~0.04/장.
 *
 * finalize 흐름이 `applyFaceSwapRestore` 로 호출 (append). flux-pulid 옵션은
 * 폐기 (PR Phase B/C 토글 도입 후 비교 결과로 face-swap 만 default 채택).
 */

import {
  submitFaceSwap,
  getFaceSwapResult,
} from '@/lib/fal/client';
import type { CatalogPersonality } from '@/lib/snap/catalog';

export type IdentityMode = 'off' | 'face-swap';

const VALID_MODES: readonly IdentityMode[] = ['off', 'face-swap'];

/** env SNAP_IDENTITY_MODE 읽기. 기본 'face-swap' (PR 결정사항 — default ON). */
export function getIdentityMode(): IdentityMode {
  const v = process.env.SNAP_IDENTITY_MODE;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as IdentityMode;
  }
  return 'face-swap';
}

/**
 * face-swap 후처리. catalog 생성 결과 URL 받아 selfie 얼굴로 교체된 새 URL 반환.
 *
 * solo: 단일 swap.
 * together: 2회 순차 swap. face_index 0 = 첫 번째 발견 얼굴 (보통 왼쪽 = 신랑),
 *           face_index 1 = 두 번째 얼굴 (오른쪽 = 신부). 카탈로그/모델에 따라
 *           index 순서가 다를 수 있어 결과 점검 후 조정 필요할 수도 있음.
 *
 * 실패 시 throw — 호출 측이 try/catch 로 원본 결과 폴백.
 */
export async function applyFaceSwapRestore(input: {
  generatedUrl: string;
  personality: CatalogPersonality;
  groomSelfieUrl?: string | null;
  brideSelfieUrl?: string | null;
}): Promise<string> {
  let currentUrl = input.generatedUrl;

  if (input.personality === 'groom-solo') {
    if (!input.groomSelfieUrl) return currentUrl; // selfie 없으면 skip.
    const reqId = await submitFaceSwap({
      sourceImageUrl: input.groomSelfieUrl,
      targetImageUrl: currentUrl,
    });
    currentUrl = await getFaceSwapResult(reqId);
    return currentUrl;
  }

  if (input.personality === 'bride-solo') {
    if (!input.brideSelfieUrl) return currentUrl;
    const reqId = await submitFaceSwap({
      sourceImageUrl: input.brideSelfieUrl,
      targetImageUrl: currentUrl,
    });
    currentUrl = await getFaceSwapResult(reqId);
    return currentUrl;
  }

  // together — 2 swaps. 신랑 먼저 (index 0), 신부 다음 (index 1).
  if (input.groomSelfieUrl) {
    const reqId = await submitFaceSwap({
      sourceImageUrl: input.groomSelfieUrl,
      targetImageUrl: currentUrl,
      faceIndex: 0,
    });
    currentUrl = await getFaceSwapResult(reqId);
  }
  if (input.brideSelfieUrl) {
    const reqId = await submitFaceSwap({
      sourceImageUrl: input.brideSelfieUrl,
      targetImageUrl: currentUrl,
      faceIndex: 1,
    });
    currentUrl = await getFaceSwapResult(reqId);
  }
  return currentUrl;
}

/**
 * 커플 모드 전용 face-swap restore — 사용자가 업로드한 커플 사진의 얼굴을
 * 카탈로그 결과에 입혀 정체성 보존.
 *
 * 흐름:
 *   1) 커플 사진(source) 의 2 얼굴을 fal face-swap 으로 카탈로그 결과(target) 에 적용
 *   2) face-swap 의 face_index 매핑 (0=좌, 1=우) 가 카탈로그 결과 / 원본 사진 모두
 *      같은 순서일 거라 가정 — 결과 점검 후 swap 순서 조정 가능
 *   3) 실패 시 throw, 호출 측이 fallback 처리
 *
 * 비용 +$0.02/장 (face-swap 2회).
 */
export async function applyCoupleFaceSwapRestore(input: {
  generatedUrl: string;
  couplePhotoUrl: string;
}): Promise<string> {
  let currentUrl = input.generatedUrl;
  // 첫 번째 얼굴 (좌측) 교체.
  const req1 = await submitFaceSwap({
    sourceImageUrl: input.couplePhotoUrl,
    targetImageUrl: currentUrl,
    faceIndex: 0,
  });
  currentUrl = await getFaceSwapResult(req1);
  // 두 번째 얼굴 (우측) 교체. fal face-swap 의 source 는 같은 사진이지만
  // face_index 가 0 으로 고정될 수 있어 정확도가 떨어질 수 있음 — 다만
  // 커플 사진은 보통 좌우 한 명씩이라 첫 swap 후 두 번째 얼굴도 source 의
  // 두 번째 얼굴(우측) 로 자동 매칭되는 경우가 일반적.
  const req2 = await submitFaceSwap({
    sourceImageUrl: input.couplePhotoUrl,
    targetImageUrl: currentUrl,
    faceIndex: 1,
  });
  currentUrl = await getFaceSwapResult(req2);
  return currentUrl;
}
