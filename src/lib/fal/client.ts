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
  /** fal 완료 시 콜백 받을 webhook URL. 미지정 시 polling 으로만 처리. */
  webhookUrl?: string;
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
    ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
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
  /** fal 완료 시 콜백 받을 webhook URL. 미지정 시 polling 으로만 처리. */
  webhookUrl?: string;
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
    ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
  });
  if (!request_id) throw new Error('fal.queue.submit returned no request_id');
  return request_id;
}

export type FalQueueStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/**
 * 임의의 fal model 큐 상태 조회. gpt-image-2 등 모델별로 다른 endpoint 가
 * 필요해 model id 를 받아 동적 라우팅.
 */
export async function getFalQueueStatus(
  model: string,
  requestId: string,
): Promise<{ status: FalQueueStatus; queuePosition?: number }> {
  ensureConfigured();
  const status = (await fal.queue.status(model, { requestId })) as {
    status: FalQueueStatus;
    queue_position?: number;
  };
  return {
    status: status.status,
    queuePosition: status.queue_position,
  };
}

/** gpt-image-2 큐 작업 상태 조회 (0.5–1초). 기존 호출자 호환용 wrapper. */
export async function getImageEditStatus(requestId: string): Promise<{
  status: FalQueueStatus;
  queuePosition?: number;
}> {
  return getFalQueueStatus(GPT_IMAGE_MODEL, requestId);
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

// ─────────────────────────────────────────────────────────────
// Foreground segmentation (birefnet) — 마스크 기반 색매칭에 사용.
// 출력: 흑백 마스크 (foreground=white, background=black) PNG.
// 비용 ~$0.003/장.
// ─────────────────────────────────────────────────────────────

const BIREFNET_MODEL = 'fal-ai/birefnet';

interface BirefnetResult {
  image?: { url: string };
  mask_image?: { url: string };
}

/**
 * 생성 이미지에서 foreground (=신랑/신부) 마스크 추출.
 * harmonize 단계에서 배경엔 강하게, 사람엔 약하게 색매칭하도록 가중치 마스크로 활용.
 */
export async function submitBirefnetMask(input: {
  imageUrl: string;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(BIREFNET_MODEL, {
    input: { image_url: input.imageUrl },
  });
  if (!request_id) throw new Error('birefnet.submit returned no request_id');
  return request_id;
}

export async function getBirefnetResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(BIREFNET_MODEL, { requestId });
  const data = result.data as BirefnetResult;
  // birefnet 은 foreground 가 alpha 로 합성된 png 와 별도 mask png 둘 다 반환할 수 있음.
  // mask_image 가 있으면 우선 사용 (raw 흑백 마스크).
  const url = data.mask_image?.url ?? data.image?.url;
  if (!url) throw new Error('birefnet.result returned no mask url');
  return url;
}

// ─────────────────────────────────────────────────────────────
// Flux dev img2img — Phase 2 마감 패스 (저강도 색/조명 통합).
// strength 0.15~0.25 로 호출해 identity drift 없이 톤/그레인만 정렬.
// 비용 ~$0.025/장 (flux/dev, medium quality).
// ─────────────────────────────────────────────────────────────

const FLUX_IMG2IMG_MODEL = 'fal-ai/flux/dev/image-to-image';

interface FluxImg2ImgResult {
  images: { url: string; content_type?: string }[];
}

/**
 * 저강도 img2img 마감 패스. 입력 이미지의 composition / identity / pose 는
 * 거의 그대로 유지(strength≤0.25) 하면서 prompt 가 묘사하는 톤/조명/그레인으로
 * 미세 보정. wedding snap 의 카탈로그 결과 → "한 카메라로 찍은 컷" 일관성 부여.
 *
 * 권장 파라미터:
 *   - strength: 0.18~0.22 (0.25 이상은 identity drift 위험)
 *   - num_inference_steps: 28~30 (기본 28)
 *   - guidance_scale: 3.5 (낮게) — 프롬프트에 너무 끌려가지 않게
 */
export async function submitFluxImg2Img(input: {
  imageUrl: string;
  prompt: string;
  strength?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(FLUX_IMG2IMG_MODEL, {
    input: {
      image_url: input.imageUrl,
      prompt: input.prompt,
      strength: input.strength ?? 0.2,
      num_inference_steps: input.numInferenceSteps ?? 28,
      guidance_scale: input.guidanceScale ?? 3.5,
      num_images: 1,
      enable_safety_checker: false,
    },
  });
  if (!request_id) throw new Error('flux-img2img.submit returned no request_id');
  return request_id;
}

export async function getFluxImg2ImgResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(FLUX_IMG2IMG_MODEL, { requestId });
  const data = result.data as FluxImg2ImgResult;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('flux-img2img.result returned no image url');
  return url;
}

// ─────────────────────────────────────────────────────────────
// Face swap (identity restore) — SNAP_IDENTITY_MODE=face-swap 일 때 사용.
//
// catalog 생성 후 결과물의 얼굴을 원본 selfie 의 얼굴로 교체해 identity drift
// 를 보정. multi-image composition (gpt-image-2) 의 한계인 얼굴 미세 변형을
// 사후 처리로 해결. 카탈로그 구도/배경/의상은 그대로 유지.
//
// 비용 ~$0.01~0.02/장.
// ─────────────────────────────────────────────────────────────

const FACE_SWAP_MODEL = 'fal-ai/face-swap';

interface FaceSwapResult {
  image?: { url: string };
  images?: { url: string }[];
}

/**
 * 얼굴 교체. target_image 의 얼굴(들)을 source_image 의 얼굴로 교체.
 *
 * @param input.sourceImageUrl  교체할 얼굴 원본 (사용자 selfie)
 * @param input.targetImageUrl  교체 대상 (catalog 결과물)
 * @param input.faceIndex       target 에 여러 얼굴이 있을 때 몇 번째 얼굴을 교체할지 (0-based, optional)
 */
export async function submitFaceSwap(input: {
  sourceImageUrl: string;
  targetImageUrl: string;
  faceIndex?: number;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(FACE_SWAP_MODEL, {
    input: {
      source_image_url: input.sourceImageUrl,
      target_image_url: input.targetImageUrl,
      ...(typeof input.faceIndex === 'number'
        ? { face_index: input.faceIndex }
        : {}),
    },
  });
  if (!request_id) throw new Error('face-swap.submit returned no request_id');
  return request_id;
}

export async function getFaceSwapResult(requestId: string): Promise<string> {
  ensureConfigured();
  const result = await fal.queue.result(FACE_SWAP_MODEL, { requestId });
  const data = result.data as FaceSwapResult;
  const url = data.image?.url ?? data.images?.[0]?.url;
  if (!url) throw new Error('face-swap.result returned no image url');
  return url;
}

// ─────────────────────────────────────────────────────────────
// Face similarity (ArcFace embedding 기반).
//
// 두 이미지의 얼굴 정체성 일치도를 0..1 cosine similarity 로 반환.
// PR 7 의 finalize 단계 quality gate / face restore 의존성.
//
// 정확한 fal endpoint 는 환경에 따라 다를 수 있음 (예: fal-ai/face-similarity,
// fal-ai/insightface/compare 등). 환경 변수로 override 가능하게 설계.
//
// 응답 schema (보수적 파싱): { similarity?: number, score?: number, cosine?: number }
// 위 세 키 중 하나라도 있으면 사용.
// ─────────────────────────────────────────────────────────────

const FACE_SIMILARITY_MODEL =
  process.env.FAL_FACE_SIMILARITY_MODEL ?? 'fal-ai/face-similarity';

interface FaceSimilarityResult {
  similarity?: number;
  score?: number;
  cosine?: number;
  /** 일부 endpoint 는 0..100 % 로 반환 — 100 보다 크면 0..1 로 정규화. */
  similarity_percent?: number;
}

export async function submitFaceSimilarity(input: {
  imageUrl1: string;
  imageUrl2: string;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(FACE_SIMILARITY_MODEL, {
    input: {
      image_url_1: input.imageUrl1,
      image_url_2: input.imageUrl2,
    },
  });
  if (!request_id) throw new Error('face-similarity.submit returned no request_id');
  return request_id;
}

export async function getFaceSimilarityResult(requestId: string): Promise<number> {
  ensureConfigured();
  const result = await fal.queue.result(FACE_SIMILARITY_MODEL, { requestId });
  const data = result.data as FaceSimilarityResult;
  // 다양한 응답 키 순서대로 시도.
  let score: number | undefined =
    data.similarity ?? data.cosine ?? data.score ?? undefined;
  if (score === undefined && data.similarity_percent !== undefined) {
    score = data.similarity_percent / 100;
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error('face-similarity.result returned no usable score');
  }
  // 0..1 로 클램핑.
  return Math.max(0, Math.min(1, score));
}

/**
 * 두 이미지 간 face similarity 한 번에 측정. 실패 시 throw.
 *
 * fal.subscribe() 사용 — submit/status/result 를 SDK 가 자동 polling.
 * `logs: true` 로 fal worker 실행 로그를 함께 받아 job 이 실패할 때 정확한 원인
 * (예: URL fetch 불가 / 모델 입력 거부) 을 진단 로그에 노출. job 의 request_id
 * 도 error message 에 부착해 fal 대시보드에서 추적 가능.
 */
export async function compareFaces(
  imageUrl1: string,
  imageUrl2: string,
): Promise<number> {
  ensureConfigured();
  let requestId: string | undefined;
  let result: unknown;
  try {
    result = await fal.subscribe(FACE_SIMILARITY_MODEL, {
      input: { image_url_1: imageUrl1, image_url_2: imageUrl2 },
      logs: true,
      onQueueUpdate: (update) => {
        captureRequestIdAndLogs(update, 'face-similarity', (rid) => {
          requestId = rid;
        });
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown';
    throw new Error(
      `face-similarity failed (${FACE_SIMILARITY_MODEL}, requestId=${requestId ?? 'n/a'}): ${detail}`,
      { cause: e },
    );
  }
  const data = (result as { data?: FaceSimilarityResult }).data ?? (result as FaceSimilarityResult);
  let score: number | undefined =
    data.similarity ?? data.cosine ?? data.score ?? undefined;
  if (score === undefined && data.similarity_percent !== undefined) {
    score = data.similarity_percent / 100;
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error(
      `face-similarity returned no usable score (${FACE_SIMILARITY_MODEL}, requestId=${requestId ?? 'n/a'}): keys=${Object.keys(data).join(',')}`,
    );
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * fal.subscribe 의 onQueueUpdate 콜백 헬퍼.
 * request_id 캡처 + IN_PROGRESS 의 마지막 log 라인만 콘솔로 노출 — job 이 실패할
 * 때 그 마지막 라인이 보통 진짜 원인 (예: "Failed to download image", "Invalid
 * input format" 등) 을 담는다.
 */
function captureRequestIdAndLogs(
  update: unknown,
  label: string,
  onRequestId: (rid: string) => void,
): void {
  const u = update as {
    status?: string;
    request_id?: string;
    logs?: Array<{ message?: string; level?: string; timestamp?: string }>;
  };
  if (u.request_id) onRequestId(u.request_id);
  if (Array.isArray(u.logs) && u.logs.length > 0) {
    const last = u.logs[u.logs.length - 1];
    if (last?.message) {
      console.info(`[fal/${label}]`, {
        requestId: u.request_id,
        status: u.status,
        level: last.level,
        message: last.message,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Face detection — 입력 사진의 얼굴 수 / 위치 / 크기 검증.
// Anchor / couple 입력 단계에서 호출해 너무 작거나 detect 안 되는 얼굴이 들어가
// 하류 실패율을 키우는 케이스를 사전 차단.
//
// fal-ai/imageutils/face-detection 사용 (~$0.001/장 추정).
// 응답: faces[].bbox = [x_min, y_min, x_max, y_max], optional score / landmarks.
//
// 응답 schema 가 모델별로 다를 수 있어 보수적 파싱: faces 배열만 있으면 OK.
// ─────────────────────────────────────────────────────────────

// fal 의 face-detection endpoint 가 변경되거나 일시 장애일 때 사용자가 env 로
// 즉시 교체할 수 있도록 override 허용. default 는 imageutils 의 face-detection.
const FACE_DETECTION_MODEL =
  process.env.FAL_FACE_DETECTION_MODEL ?? 'fal-ai/imageutils/face-detection';

export interface DetectedFace {
  /** [x_min, y_min, x_max, y_max] pixel coords */
  bbox: [number, number, number, number];
  /** detection confidence 0..1 (있을 때만) */
  score?: number;
}

interface FaceDetectionResult {
  faces?: Array<{
    bbox?: number[];
    box?: number[];
    score?: number;
    confidence?: number;
  }>;
  // 일부 변형 endpoint 는 image_size 도 함께 반환.
  image?: { width?: number; height?: number };
}

export async function submitFaceDetection(input: {
  imageUrl: string;
}): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(FACE_DETECTION_MODEL, {
    input: { image_url: input.imageUrl },
  });
  if (!request_id) throw new Error('face-detection.submit returned no request_id');
  return request_id;
}

export async function getFaceDetectionResult(
  requestId: string,
): Promise<DetectedFace[]> {
  ensureConfigured();
  const result = await fal.queue.result(FACE_DETECTION_MODEL, { requestId });
  const data = result.data as FaceDetectionResult;
  const raw = data.faces ?? [];
  // bbox / box 둘 다 지원 (모델 변형 대응). score / confidence 도 union.
  return raw
    .map((f): DetectedFace | null => {
      const arr = f.bbox ?? f.box;
      if (!arr || arr.length < 4) return null;
      return {
        bbox: [arr[0]!, arr[1]!, arr[2]!, arr[3]!],
        score: f.score ?? f.confidence,
      };
    })
    .filter((f): f is DetectedFace => f !== null);
}

/**
 * fal.subscribe() 로 submit/poll/result 를 SDK 가 한 번에 처리.
 *
 * 과거 submit+result 분리 방식에서 result() 가 "Bad Request" 류로 throw 되는
 * 케이스 보고됨 (fal queue 가 result 호출 시 job 실패를 그대로 전파). subscribe
 * 는 worker 실행 로그(`logs: true`) 와 함께 진짜 원인을 노출 — fal 측 URL
 * fetch 실패 / 모델 입력 거부 / endpoint 변경 등을 IN_PROGRESS 단계 로그에서
 * 확인 가능.
 *
 * request_id 도 error message 에 부착해 fal 대시보드에서 추적 가능.
 */
export async function detectFaces(imageUrl: string): Promise<DetectedFace[]> {
  ensureConfigured();
  let requestId: string | undefined;
  let result: unknown;
  try {
    result = await fal.subscribe(FACE_DETECTION_MODEL, {
      input: { image_url: imageUrl },
      logs: true,
      onQueueUpdate: (update) => {
        captureRequestIdAndLogs(update, 'face-detection', (rid) => {
          requestId = rid;
        });
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown';
    throw new Error(
      `face-detection failed (${FACE_DETECTION_MODEL}, requestId=${requestId ?? 'n/a'}): ${detail}`,
      { cause: e },
    );
  }
  const data = (result as { data?: FaceDetectionResult }).data ?? (result as FaceDetectionResult);
  const raw = data.faces ?? [];
  return raw
    .map((f): DetectedFace | null => {
      const arr = f.bbox ?? f.box;
      if (!arr || arr.length < 4) return null;
      return {
        bbox: [arr[0]!, arr[1]!, arr[2]!, arr[3]!],
        score: f.score ?? f.confidence,
      };
    })
    .filter((f): f is DetectedFace => f !== null);
}
