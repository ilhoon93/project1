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

export interface NanoBananaEditResult {
  images: { url: string; content_type?: string }[];
  description?: string;
}

/**
 * Edit an image with the nano-banana model.
 * Returns the first image URL (fal.ai CDN — short-lived, must be re-stored).
 */
export async function editImage(input: {
  imageUrl: string;
  prompt: string;
}): Promise<string> {
  ensureConfigured();
  const result = await fal.subscribe('fal-ai/nano-banana/edit', {
    input: {
      image_urls: [input.imageUrl],
      prompt: input.prompt,
      num_images: 1,
    },
  });
  const data = result.data as NanoBananaEditResult;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image');
  return url;
}

// ─────────────────────────────────────────────────────────────
// chatGPT 2.0 (OpenAI gpt-image / fal-ai/gpt-image-1/edit-image) — 큐 모드
//
// fal.subscribe 는 작업이 끝날 때까지 함수가 블록되어 60초 + α 가 걸릴 수 있다.
// Vercel Hobby 의 60s 제한과 충돌하므로 `fal.queue.submit / status / result` 로
// 분리해 사용한다. 한 번의 함수 호출은 1–5초로 짧고, 클라이언트가 폴링한다.
// ─────────────────────────────────────────────────────────────

const GPT_IMAGE_MODEL = 'fal-ai/gpt-image-1/edit-image';

interface GptImageEditResult {
  images: { url: string; content_type?: string }[];
}

/** 작업 제출 → 큐 request_id 반환 (1–3초). */
export async function submitImageEdit(input: {
  imageUrl: string;
  prompt: string;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(GPT_IMAGE_MODEL, {
    input: {
      image_urls: [input.imageUrl],
      prompt: input.prompt,
      num_images: 1,
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
