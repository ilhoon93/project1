// 업로드 한도 — UI 메시지와 검증 로직이 같은 상수를 참조하도록 한 곳에 모은다.
//
// 이미지: 클라이언트에서 browser-image-compression 으로 압축 후 업로드 (대략 1.5–3MB).
// 비디오: 트랜스코딩하지 않고 원본 그대로 업로드 → 화질 보존. 길이/용량만 검증.
// 오디오: 기존 정책 유지.

export const IMAGE_LIMITS = {
  /** 사용자가 선택할 수 있는 원본 최대 용량 (압축 전). */
  maxInputBytes: 25 * 1024 * 1024,
  /** 압축 결과 목표 용량 — browser-image-compression 의 maxSizeMB 인자. */
  targetMB: 2,
  /** 압축 시 가장 긴 변 픽셀 — 4K 이상 사진을 합리적 크기로 줄인다. */
  maxDimension: 2400,
  /** 압축 출력 품질 (0–1). 0.92 정도면 시각적으로 거의 무손실. */
  initialQuality: 0.92,
  acceptMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
  acceptExtLabel: 'JPG · PNG · WEBP',
};

export const VIDEO_LIMITS = {
  /** 30초까지 허용 — 길이는 우선 (용량보다 강제). */
  maxDurationSec: 30,
  /** 4K HEVC 30초 (~80MB) / 1080p H.264 high-bitrate 30초도 통과. */
  maxBytes: 100 * 1024 * 1024,
  acceptMime: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
  acceptExtLabel: 'MP4 · WebM · MOV',
};

export const AUDIO_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  acceptMime: [
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/ogg',
  ] as const,
  acceptExtLabel: 'MP3 · M4A · AAC · WAV · OGG',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
