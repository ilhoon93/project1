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
// chatGPT 2.0 (OpenAI gpt-image / fal-ai/gpt-image-1/edit-image)
// ─────────────────────────────────────────────────────────────

interface GptImageEditResult {
  images: { url: string; content_type?: string }[];
}

/**
 * fal.ai 의 chatGPT 2.0 (OpenAI gpt-image-1) 인페인팅 모델로 이미지 편집.
 *
 * 모델 슬러그: `fal-ai/gpt-image-1/edit-image/byok` 또는 `fal-ai/gpt-image-1/edit-image`
 * 둘 다 같은 입력 스키마를 받는다 — 사진 URL 1개 + 프롬프트.
 *
 * 기본은 BYOK (Bring Your Own Key) 가 아닌 fal.ai 가 OpenAI 키를 대신 호출해
 * 결제하는 `edit-image` 엔드포인트를 사용한다. fal.ai 의 `FAL_KEY` 한 개만 있으면
 * 동작하기 때문에 사용자 셋업 부담이 없다.
 */
export async function editImageWithGptImage(input: {
  imageUrl: string;
  prompt: string;
}): Promise<string> {
  ensureConfigured();
  const result = await fal.subscribe('fal-ai/gpt-image-1/edit-image', {
    input: {
      image_urls: [input.imageUrl],
      prompt: input.prompt,
      num_images: 1,
    },
  });
  const data = result.data as GptImageEditResult;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai (gpt-image-1) returned no image');
  return url;
}
