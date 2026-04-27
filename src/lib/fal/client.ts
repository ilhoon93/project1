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
