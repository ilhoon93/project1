/**
 * Visual theme presets for published invitations.
 * Schema in invitation.ts stores the chosen *keys*; this file maps keys to actual values.
 */

export const COLOR_THEMES = ['cream', 'blush', 'sage', 'dusk'] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  dot: string;
  petals: string[];
}

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
};

export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  cream: '크림',
  blush: '블러쉬',
  sage: '세이지',
  dusk: '더스크',
};

export const PETAL_TYPES = ['flower', 'heart', 'star', 'none'] as const;
export type PetalType = (typeof PETAL_TYPES)[number];

export const PETAL_GLYPHS: Record<PetalType, string> = {
  flower: '❀',
  heart: '♥',
  star: '★',
  none: '',
};

export const PETAL_LABELS: Record<PetalType, string> = {
  flower: '꽃잎',
  heart: '하트',
  star: '별',
  none: '없음',
};

export const FONT_KEYS = ['serif', 'sans', 'gowun', 'handwritten'] as const;
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
};

export const SECTION_KEYS = [
  'main',
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
