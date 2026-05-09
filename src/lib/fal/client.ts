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

const GPT_IMAGE_MODEL = 'openai/gpt-image-2/edit';

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
