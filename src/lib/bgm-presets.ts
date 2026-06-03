// 공용 배경음악 프리셋 — 알림장 에디터(테마 → 배경 음악)에서 골라 쓰는 내장 곡 목록.
//
// 파일은 `/public/bgm/` 에 두고, 아래 BGM_FILES 에 파일명만 추가하면 목록에 자동 반영된다.
// 파일명 규칙으로 가사 유무를 구분한다:
//   - "제목-아티스트.mp3" 처럼 '-' 가 있으면 → 가사 있는 곡. 제목/아티스트로 분리하고 목록 상단에 노출.
//   - "제목.mp3" 처럼 '-' 가 없으면      → 가사 없는 연주곡. 파일명을 그대로 제목으로 사용.

export interface BgmPreset {
  /** 안정적인 키 (확장자 뗀 파일명). */
  id: string;
  title: string;
  /** 가사 있는 곡의 아티스트명. 연주곡은 null. */
  artist: string | null;
  hasLyrics: boolean;
  /** 정적 자산 URL (예: /bgm/Golden%20Path.mp3). */
  url: string;
}

// 새 곡을 추가할 때는 파일을 /public/bgm 에 올리고 여기에 파일명만 한 줄 추가한다.
const BGM_FILES = [
  "Deeper For You-melanieungar.mp3",
  "I'm So Glad-Robert Avellanet.mp3",
  'Love is a Journey-Robert Avellanet.mp3',
  'What Is Love-melanieungar.mp3',
  'Atlaslove.mp3',
  'Blooming Morning.mp3',
  'Golden Path.mp3',
  'Joyful Steps.mp3',
  'Sunday Evening Swing.mp3',
  'Vlog Journey.mp3',
  'Whisper of Light.mp3',
] as const;

function toPreset(file: string): BgmPreset {
  const base = file.replace(/\.[^.]+$/, ''); // 확장자 제거
  const dash = base.indexOf('-');
  const hasLyrics = dash !== -1;
  return {
    id: base,
    title: (hasLyrics ? base.slice(0, dash) : base).trim(),
    artist: hasLyrics ? base.slice(dash + 1).trim() : null,
    hasLyrics,
    // 공백·따옴표 등이 들어간 파일명을 안전하게 인코딩.
    url: `/bgm/${encodeURIComponent(file)}`,
  };
}

// 가사 있는 곡을 먼저, 그다음 연주곡. 그룹 내 순서는 BGM_FILES 정의 순서를 유지한다.
export const BGM_PRESETS: BgmPreset[] = (() => {
  const all = BGM_FILES.map(toPreset);
  return [...all.filter((p) => p.hasLyrics), ...all.filter((p) => !p.hasLyrics)];
})();

/** 현재 선택된 url 이 어떤 프리셋인지 찾는다 (선택 표시용). 외부 URL/업로드면 undefined. */
export function findBgmPreset(url: string | null): BgmPreset | undefined {
  if (!url) return undefined;
  return BGM_PRESETS.find((p) => p.url === url);
}
