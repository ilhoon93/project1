import { fal } from '@fal-ai/client';

let configured = false;

/** Configure the fal client lazily so unit tests / build time can run without FAL_KEY. */
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not set');
  fal.config({ credentials: key });
  configured = true;
}

// ─────────────────────────────────────────────────────────────
// OpenAI gpt-image-2 (fal.ai 호스팅) — 큐 모드
//
// fal.subscribe 는 작업이 끝날 때까지 함수가 블록되어 60초 + α 가 걸릴 수 있다.
// Vercel Hobby 의 60s 제한과 충돌하므로 `fal.queue.submit / status / result` 로
// 분리해 사용한다. 한 번의 함수 호출은 1–5초로 짧고, 클라이언트가 폴링한다.
//
// fal.ai 의 OpenAI 파트너 모델은 'fal-ai/' 가 아닌 'openai/' 네임스페이스를 쓴다.
// 입출력 스키마는 fal 표준 — 입력 image_urls/prompt, 출력 data.images[0].url.
// ─────────────────────────────────────────────────────────────

export const GPT_IMAGE_MODEL = 'openai/gpt-image-2/edit';

// quality: 'low' | 'medium' | 'high' | 'auto' — fal default 는 'high'.
//   high: 출력 ~4,160 토큰(1024²) → ~$0.13/회. 디테일 가장 많음.
//   medium: 출력 ~1,056 토큰(1024²) → ~$0.04/회. 인페인팅에선 종종 충분.
//   low: 출력 ~272 토큰 → ~$0.01/회. 거친 결과.
// image_size: fal 매핑 — 'square_hd' = 1024², 'portrait_4_3' = 1024×1536,
//   'landscape_4_3' = 1536×1024 등. 결혼사진은 보통 portrait.
export type GptImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type GptImageSize =
  | 'square_hd'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9';

interface GptImageEditResult {
  images: { url: string; content_type?: string }[];
}

/** 작업 제출 → 큐 request_id 반환 (1–3초). */
export async function submitImageEdit(input: {
  imageUrl: string;
  prompt: string;
  quality?: GptImageQuality;
  imageSize?: GptImageSize;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(GPT_IMAGE_MODEL, {
    input: {
      image_urls: [input.imageUrl],
      prompt: input.prompt,
      num_images: 1,
      ...(input.quality ? { quality: input.quality } : {}),
      ...(input.imageSize ? { image_size: input.imageSize } : {}),
    },
  });
  if (!request_id) throw new Error('fal.queue.submit returned no request_id');
  return request_id;
}

/**
 * 다중 이미지 입력 모드 — gpt-image-2/edit 의 image_urls 가 배열을 받는 점을 활용.
 * 웨딩스냅 합성에서 [신랑얼굴, 신부얼굴, 카탈로그 마스터샘플] 3장을 한번에 넘기고
 * prompt 로 "image 1 face → groom, image 2 face → bride, compose like image 3"
 * 식으로 역할을 명시한다. 단일 입력보다 face fidelity 와 구도 일관성이 좋아진다.
 */
export async function submitMultiImageEdit(input: {
  imageUrls: string[];
  prompt: string;
  quality?: GptImageQuality;
  imageSize?: GptImageSize;
}): Promise<string> {
  ensureConfigured();
  if (input.imageUrls.length === 0) {
    throw new Error('submitMultiImageEdit: imageUrls must not be empty');
  }
  const { request_id } = await fal.queue.submit(GPT_IMAGE_MODEL, {
    input: {
      image_urls: input.imageUrls,
      prompt: input.prompt,
      num_images: 1,
      ...(input.quality ? { quality: input.quality } : {}),
      ...(input.imageSize ? { image_size: input.imageSize } : {}),
    },
  });
  if (!request_id) throw new Error('fal.queue.submit returned no request_id');
  return request_id;
}

export type FalQueueStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/** 큐 작업 상태 조회 (0.5–1초). */
export async function getImageEditStatus(requestId: string): Promise<{
  status: FalQueueStatus;
  queuePosition?: number;
}> {
  ensureConfigured();
  const status = (await fal.queue.status(GPT_IMAGE_MODEL, {
    requestId,
  })) as { status: FalQueueStatus; queue_position?: number };
  return {
    status: status.status,
    queuePosition: status.queue_position,
  };
}

/** 완료된 큐 작업의 결과 이미지 URL 반환 (1–2초). status === 'COMPLETED' 일 때만 호출. */
export async function getImageEditResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(GPT_IMAGE_MODEL, { requestId });
  const data = result.data as GptImageEditResult;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.queue.result returned no image url');
  return url;
}

// 업스케일러 (fal-ai/clarity-upscaler) 는 얼굴이 과하게 변형되는 문제로 제거.
// 대신 후처리 업스케일은 lib/snap/postprocess.ts 에서 아래 두 모델 사용:
//   - aura-sr (Real-ESRGAN 계열) : 얼굴 보존 ★★★★★, detail 약함
//   - topaz/upscale/image        : 얼굴 보존 ★★★★, detail 강함

// ─────────────────────────────────────────────────────────────
// 업스케일 헬퍼 — fal.queue.submit / status / result 패턴 동일
// ─────────────────────────────────────────────────────────────

const AURA_SR_MODEL = 'fal-ai/aura-sr';
const TOPAZ_UPSCALE_MODEL = 'fal-ai/topaz/upscale/image';

interface UpscaleResult {
  image?: { url: string };
  images?: { url: string }[];
}

/**
 * aura-sr — Real-ESRGAN 계열. 얼굴 보존 매우 잘. detail 추가 약함.
 * 2x / 4x 지원. 기본은 4x 라 명시적으로 2 권장 (over-upscale 시 soft 함이
 * 그대로 큰 캔버스로 확대돼 효과 미미).
 */
export async function submitAuraSrUpscale(input: {
  imageUrl: string;
  scale?: 2 | 4;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(AURA_SR_MODEL, {
    input: {
      image_url: input.imageUrl,
      upscale_factor: input.scale ?? 2,
    },
  });
  if (!request_id) throw new Error('aura-sr.submit returned no request_id');
  return request_id;
}

export async function getAuraSrResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(AURA_SR_MODEL, { requestId });
  const data = result.data as UpscaleResult;
  const url = data.image?.url ?? data.images?.[0]?.url;
  if (!url) throw new Error('aura-sr.result returned no image url');
  return url;
}

/**
 * Topaz Gigapixel image upscale — 사진 전용 학습. detail 복원이 가장 우수.
 *
 * 안전 파라미터:
 *   - model: 'Standard V2' (보수적, identity 안전) 또는 'High Fidelity V2'
 *   - face_enhancement: false  ← 필수. true 면 얼굴 변형 위험
 *   - subject_detection: 'All' — 균일 처리 (fal SDK 가 'None' 미지원)
 */
export async function submitTopazUpscale(input: {
  imageUrl: string;
  scale?: 2 | 4;
  model?:
    | 'Standard V2'
    | 'High Fidelity V2'
    | 'Low Resolution V2'
    | 'CGI'
    | 'Text Refine'
    | 'Recovery'
    | 'Redefine';
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(TOPAZ_UPSCALE_MODEL, {
    input: {
      image_url: input.imageUrl,
      model: input.model ?? 'Standard V2',
      upscale_factor: input.scale ?? 2,
      face_enhancement: false,
      subject_detection: 'All',
      output_format: 'jpeg',
    },
  });
  if (!request_id) throw new Error('topaz-upscale.submit returned no request_id');
  return request_id;
}

export async function getTopazResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(TOPAZ_UPSCALE_MODEL, { requestId });
  const data = result.data as UpscaleResult;
  const url = data.image?.url ?? data.images?.[0]?.url;
  if (!url) throw new Error('topaz-upscale.result returned no image url');
  return url;
}
