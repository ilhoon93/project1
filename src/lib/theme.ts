/**
 * Visual theme presets for published invitations.
 * Schema in invitation.ts stores the chosen *keys*; this file maps keys to actual values.
 */

export const COLOR_THEMES = [
  'cream',
  'blush',
  'sage',
  'dusk',
  // 패턴/질감 계열 (혼주용 포함)
  'hanji',
  'damask',
  'royal',
  'pearl',
] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  dot: string;
  petals: string[];
  /** Optional CSS background-image layered on top of `bg`. Used for patterned/textured themes. */
  bgPattern?: string;
}

// 작은 SVG 패턴들 — data URI로 인라인. 색은 currentColor 대신 옅은 톤으로 고정.
const HANJI_PATTERN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const DAMASK_PATTERN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='%23C8A85B' stroke-width='1.1' opacity='0.35'><path d='M40 6 C 52 18 52 30 40 40 C 28 30 28 18 40 6 Z'/><path d='M40 74 C 52 62 52 50 40 40 C 28 50 28 62 40 74 Z'/><path d='M6 40 C 18 52 30 52 40 40 C 30 28 18 28 6 40 Z'/><path d='M74 40 C 62 52 50 52 40 40 C 50 28 62 28 74 40 Z'/><circle cx='40' cy='40' r='3' fill='%23C8A85B' stroke='none'/></g></svg>\")";

const ROYAL_PATTERN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='%23D4B068' opacity='0.18'><path d='M30 8 l3 9 l9 0 l-7 6 l3 9 l-8 -6 l-8 6 l3 -9 l-7 -6 l9 0 z'/><circle cx='6' cy='30' r='1.6'/><circle cx='54' cy='30' r='1.6'/><circle cx='30' cy='54' r='1.6'/></g></svg>\")";

const PEARL_PATTERN =
  'radial-gradient(circle at 30% 20%, rgba(255,230,235,0.55) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 75% 70%, rgba(220,235,255,0.5) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 50% 50%, rgba(255,250,240,0.35) 0%, rgba(255,255,255,0) 60%)';

export const THEME_PALETTES: Record<ColorTheme, Palette> = {
  cream: {
    bg: '#FAF7F2',
    fg: '#3D2E1F',
    accent: '#8B7355',
    dot: '#D4C5B0',
    petals: ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'],
  },
  blush: {
    bg: '#FFF4F1',
    fg: '#5C2A2E',
    accent: '#C9748E',
    dot: '#E5B8BD',
    petals: ['#FFD1D9', '#FFB6C1', '#FFC0CB', '#FFE4E1'],
  },
  sage: {
    bg: '#F1F5EE',
    fg: '#2D4A33',
    accent: '#658067',
    dot: '#C8D5C0',
    petals: ['#C4D9C0', '#A8C5A1', '#D5E5CD', '#B3CFA8'],
  },
  dusk: {
    bg: '#221C2E',
    fg: '#F5E9D0',
    accent: '#D4B5A0',
    dot: '#5C4F75',
    petals: ['#B8A6D6', '#D4A5DC', '#DDD0EB', '#E8D5F2'],
  },
  // 한지 — 따뜻한 베이지에 종이 섬유 노이즈. 어르신/혼주께 친숙한 한국적 분위기.
  hanji: {
    bg: '#F2E8D5',
    fg: '#3A2A1A',
    accent: '#8C5A3C',
    dot: '#C9B189',
    petals: ['#E8C7A1', '#D6A88A', '#F0D6B8', '#C49A78'],
    bgPattern: HANJI_PATTERN,
  },
  // 다마스크 — 와인/버건디 바탕에 골드 패턴. 격식 있는 혼주용.
  damask: {
    bg: '#3A1F25',
    fg: '#F4E4C8',
    accent: '#D4B068',
    dot: '#7A4B53',
    petals: ['#D4B068', '#C8A85B', '#E8D5A0', '#B89548'],
    bgPattern: DAMASK_PATTERN,
  },
  // 로열 — 딥 네이비 + 골드. 가장 포멀한 혼주용 톤.
  royal: {
    bg: '#16243F',
    fg: '#F1E5C8',
    accent: '#D4B068',
    dot: '#3D4F75',
    petals: ['#D4B068', '#E8D5A0', '#C8A85B', '#F0DFA8'],
    bgPattern: ROYAL_PATTERN,
  },
  // 펄 — 광택 그라디언트로 진주빛 표현. 모던 + 혼주 모두 무난.
  pearl: {
    bg: '#F8F4EE',
    fg: '#3D2E2A',
    accent: '#A88B6E',
    dot: '#DCCFBE',
    petals: ['#F5E1DA', '#E8D0C8', '#FFFFFF', '#EFD9D2'],
    bgPattern: PEARL_PATTERN,
  },
};

export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  cream: '크림',
  blush: '블러쉬',
  sage: '세이지',
  dusk: '더스크',
  hanji: '한지',
  damask: '다마스크 (혼주)',
  royal: '로열 네이비 (혼주)',
  pearl: '펄',
};

// 'flower'/'heart'/'star' 는 글리프(2D), 'sakura'/'leaf'/'ring' 은 SVG 텍스처 형태.
export const PETAL_TYPES = [
  'flower',
  'heart',
  'star',
  'sakura',
  'leaf',
  'ring',
  'none',
] as const;
export type PetalType = (typeof PETAL_TYPES)[number];

/** 글리프형(폰트 문자) 효과만 매핑. SVG형은 FallingPetals 컴포넌트 내부에서 직접 그림. */
export const PETAL_GLYPHS: Record<PetalType, string> = {
  flower: '❀',
  heart: '♥',
  star: '★',
  sakura: '',
  leaf: '',
  ring: '',
  none: '',
};

export const PETAL_LABELS: Record<PetalType, string> = {
  flower: '꽃잎',
  heart: '하트',
  star: '별',
  sakura: '벚꽃잎 (질감)',
  leaf: '단풍잎 (질감)',
  ring: '반지 (질감)',
  none: '없음',
};

/** SVG 텍스처 효과 여부. true 인 키는 FallingPetals 가 SVG 로 렌더링. */
export const PETAL_IS_TEXTURE: Record<PetalType, boolean> = {
  flower: false,
  heart: false,
  star: false,
  sakura: true,
  leaf: true,
  ring: true,
  none: false,
};

export const FONT_KEYS = [
  'serif',
  'sans',
  'gowun',
  'handwritten',
  'nanumMyeongjo',
  'jejuMyeongjo',
  'songMyung',
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export interface FontOption {
  label: string;
  family: string;
}

export const FONT_OPTIONS: Record<FontKey, FontOption> = {
  serif: { label: '명조', family: "'Noto Serif KR', serif" },
  sans: { label: '고딕', family: "'Noto Sans KR', sans-serif" },
  gowun: { label: '고운바탕', family: "'Gowun Batang', serif" },
  handwritten: { label: '손글씨', family: "'Gaegu', cursive" },
  nanumMyeongjo: { label: '나눔명조', family: "'Nanum Myeongjo', serif" },
  jejuMyeongjo: { label: '제주명조', family: "'Jeju Myeongjo', serif" },
  songMyung: { label: '송명', family: "'Song Myung', serif" },
};

export const SECTION_KEYS = [
  'main',
  'basic',
  'story',
  'gallery',
  'video',
  'quiz',
  'vote',
  'guestbook',
  'account',
  'closing',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  main: '메인',
  basic: '기본정보',
  story: '스토리',
  gallery: '갤러리',
  video: '영상',
  quiz: '퀴즈',
  vote: '투표',
  guestbook: '방명록',
  account: '계좌정보',
  closing: '엔딩',
};

/**
 * Reconcile a stored pageOrder with the canonical SECTION_KEYS list.
 * Filters out unknown keys and appends any missing keys to the end so newly
 * added sections appear naturally without forcing a migration.
 */
export function reconcilePageOrder(stored: readonly string[]): SectionKey[] {
  const known = new Set<string>(SECTION_KEYS);
  const seen = new Set<string>();
  const ordered: SectionKey[] = [];

  for (const key of stored) {
    if (known.has(key) && !seen.has(key)) {
      ordered.push(key as SectionKey);
      seen.add(key);
    }
  }
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}
