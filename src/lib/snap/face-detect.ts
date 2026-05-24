'use client';

/**
 * 클라이언트 사이드 얼굴 감지 — MediaPipe Face Detector (BlazeFace short-range).
 *
 * 사용처: 커플 사진 모드에서 사용자가 업로드한 사진의 얼굴 메타를 추출해
 * "이 입력 + 이 카탈로그" 조합이 얼마나 위험한지 호환성 점수 계산에 사용.
 *
 * 추출 항목:
 *   - faceCount      : 감지된 얼굴 수 (0 / 1 / 2+)
 *   - faceSizeRatio  : 가장 큰 얼굴의 폭 ÷ 이미지 폭 (0~1)
 *                       0.30+ = 클로즈업 (얼굴 큼)
 *                       0.15~0.30 = 반신
 *                       <0.15 = 전신 / 풀샷 (얼굴 작음 → 카탈로그 closeup 과 조합 시 변형 위험)
 *
 * MediaPipe 의 BlazeFace 모델 파일은 Google 호스팅 CDN 에서 fetch (CSP 영향 가능 — 필요 시
 * NEXT_PUBLIC_MEDIAPIPE_MODEL_URL env 로 사내 호스팅 경로 주입).
 *
 * 모델 초기화는 비싸므로 모듈 단위 싱글톤 캐싱. 첫 호출 시 ~1초, 이후 즉시.
 * SSR 안전 — `typeof window === 'undefined'` 가드.
 */

import type { FaceDetector, Detection } from '@mediapipe/tasks-vision';

const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const MODEL_URL =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL?.length
    ? process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL
    : DEFAULT_MODEL_URL;

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';

let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      // dynamic import — SSR/번들 크기 보호.
      const { FaceDetector, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })().catch((err) => {
      // 모델 로드 실패 시 다음 호출에서 재시도 가능하도록 캐시 해제.
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

export interface FaceMeta {
  /** 감지된 얼굴 수 (가장 신뢰도 높은 detection 기준). */
  faceCount: number;
  /** 가장 큰 얼굴의 폭 ÷ 이미지 폭 (0~1). 얼굴 없으면 0. */
  faceSizeRatio: number;
  /** 이미지 가로/세로 픽셀 — 디버깅용. */
  imageWidth: number;
  imageHeight: number;
}

/**
 * 이미지 URL (objectURL 또는 signed URL) 에서 얼굴 메타 추출.
 * 실패 시 throw — 호출부에서 catch 해서 "측정 실패, 일반 규칙 적용" fallback 권장.
 */
export async function detectFaces(imageUrl: string): Promise<FaceMeta> {
  if (typeof window === 'undefined') {
    throw new Error('face-detect: client-only');
  }
  const detector = await getDetector();
  const img = await loadImageElement(imageUrl);
  const result = detector.detect(img);
  const detections: Detection[] = result.detections ?? [];
  if (detections.length === 0) {
    return {
      faceCount: 0,
      faceSizeRatio: 0,
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
    };
  }
  // 가장 큰 얼굴 = bounding box 폭 최대.
  let maxWidth = 0;
  for (const d of detections) {
    const w = d.boundingBox?.width ?? 0;
    if (w > maxWidth) maxWidth = w;
  }
  return {
    faceCount: detections.length,
    faceSizeRatio: img.naturalWidth > 0 ? maxWidth / img.naturalWidth : 0,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}
