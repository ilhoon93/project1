/**
 * Phase B 토글 — catalog 결과의 얼굴 identity 복원.
 *
 * env SNAP_IDENTITY_MODE 값에 따라 3가지:
 *   - 'off'        : 비활성 (현재 Phase A 결과 그대로)
 *   - 'face-swap'  : catalog 생성 결과에 face swap 후처리. 카탈로그 구도/의상/배경
 *                    그대로 유지하면서 얼굴만 selfie 진본으로 교체.
 *                    solo 1번, together 2번 swap (face_index 0=신랑, 1=신부).
 *                    비용 +$0.01~0.04/장.
 *   - 'flux-pulid' : catalog 단계 자체를 flux-pulid 로 대체. text prompt + selfie
 *                    1장으로 generative composition. identity 보존 최고급이지만
 *                    카탈로그 구도는 일부 잃음. together 모드는 flux-pulid 가
 *                    1-ID 모델이라 미지원 → face-swap 으로 자동 폴백.
 *                    비용 ~$0.05/장 (solo).
 *
 * 본 모듈은 두 모드 모두 라우트 측에서 호출 가능한 단일 entry point 를 제공.
 * generate route 가 `applyIdentityFluxPulid` 로 분기 (replace), finalize
 * 흐름이 `applyFaceSwapRestore` 로 분기 (append) 한다.
 */

import {
  submitFaceSwap,
  getFaceSwapResult,
  submitFluxPulid,
  getFluxPulidResult,
} from '@/lib/fal/client';
import type { CatalogPersonality } from '@/lib/snap/catalog';

export type IdentityMode = 'off' | 'face-swap' | 'flux-pulid';

const VALID_MODES: readonly IdentityMode[] = ['off', 'face-swap', 'flux-pulid'];

/** env SNAP_IDENTITY_MODE 읽기. 기본 'off'. */
export function getIdentityMode(): IdentityMode {
  const v = process.env.SNAP_IDENTITY_MODE;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as IdentityMode;
  }
  return 'off';
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
 * flux-pulid 생성 — catalog 단계 자체를 대체. solo 모드 한정.
 *
 * @param input.selfieUrl   유지할 얼굴 (사용자 selfie)
 * @param input.scenePrompt 장면 / 의상 / 포즈 텍스트 묘사 (catalog promptHint)
 * @param input.negative    원치 않는 요소
 */
export async function applyIdentityFluxPulid(input: {
  selfieUrl: string;
  scenePrompt: string;
  negative?: string;
}): Promise<string> {
  const reqId = await submitFluxPulid({
    referenceImageUrl: input.selfieUrl,
    prompt: input.scenePrompt,
    negativePrompt: input.negative,
    imageSize: 'portrait_4_3',
  });
  return await getFluxPulidResult(reqId);
}
