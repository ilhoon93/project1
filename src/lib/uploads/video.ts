import { VIDEO_LIMITS, formatBytes } from './limits';

export type VideoValidationResult =
  | { ok: true; file: File; durationSec: number }
  | { ok: false; message: string };

/**
 * `<video>` 엘리먼트로 메타데이터만 로드해 길이를 잰다.
 * 본문은 디코드하지 않으므로 큰 파일도 빠르게 끝남.
 *
 * 일부 브라우저는 MOV/HEVC 의 duration 을 `Infinity` 로 보고할 수 있어
 * `currentTime = 1e9` 트릭으로 강제로 끝까지 seek 해 정확한 길이를 얻는다.
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    const finish = (sec: number) => {
      cleanup();
      resolve(Number.isFinite(sec) ? sec : 0);
    };

    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
        return;
      }
      // duration === Infinity → seek trick
      video.currentTime = 1e9;
    };
    video.ontimeupdate = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('VIDEO_METADATA_LOAD_FAILED'));
    };
  });
}

/**
 * MIME / 용량 / 길이 (30초) 검증. 모두 통과하면 원본 File 그대로 반환.
 *
 * 트랜스코딩은 하지 않는다 — 화질·데이터 보존이 목적이므로
 * 사용자가 올린 그대로 Storage 에 올린다.
 */
export async function validateVideoFile(file: File): Promise<VideoValidationResult> {
  if (!VIDEO_LIMITS.acceptMime.includes(file.type as (typeof VIDEO_LIMITS.acceptMime)[number])) {
    return {
      ok: false,
      message: `${VIDEO_LIMITS.acceptExtLabel} 형식만 지원됩니다.`,
    };
  }
  if (file.size > VIDEO_LIMITS.maxBytes) {
    return {
      ok: false,
      message: `영상 크기는 ${formatBytes(VIDEO_LIMITS.maxBytes)} 이하여야 합니다.`,
    };
  }

  let durationSec: number;
  try {
    durationSec = await getVideoDuration(file);
  } catch {
    return {
      ok: false,
      message: '영상 정보를 읽을 수 없습니다. 다른 파일을 사용해주세요.',
    };
  }

  if (durationSec === 0) {
    return {
      ok: false,
      message: '영상 길이를 확인할 수 없습니다. 다른 파일을 사용해주세요.',
    };
  }
  if (durationSec > VIDEO_LIMITS.maxDurationSec + 0.5) {
    return {
      ok: false,
      message: `영상 길이는 ${VIDEO_LIMITS.maxDurationSec}초 이하만 업로드할 수 있습니다. (현재 ${durationSec.toFixed(1)}초)`,
    };
  }

  return { ok: true, file, durationSec };
}
