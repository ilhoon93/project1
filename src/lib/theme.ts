/**
 * Visual theme presets for published invitations.
 * Schema in invitation.ts stores the chosen *keys*; this file maps keys to actual values.
 */

export const COLOR_THEMES = [
  'cream',
  'blush',
  'sage',
  'dusk',
  'pearl',
  // 새로 추가된 결혼식 친화 팔레트.
  'letterPaper', // 편지지 — 박엽지/캔버스 질감 흰 바탕 + 검정 글자
  'midnight',    // 미드나잇 — 검정 배경 + 밝은 샴페인 글자
  'champagne',   // 샴페인 — 웜 아이보리 + 와인 글자, 분위기·가독성 강화
] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  dot: string;
  petals: string[];
  /** Optional CSS background-image layered on top of `bg`. Used for textured themes. */
  bgPattern?: string;
  /**
   * 일러스트형 메인 슬라이드의 PNG 이미지에 적용할 CSS filter.
   * 다크 테마에서는 'invert(...) hue-rotate(180deg)' 로 라인 아트가 밝게
   * 보이도록 하고, 라이트 테마에서는 'none' (또는 미설정 = 'none').
   *
   * --mw-illust-filter 변수로 노출되므로 사용자가 직접 오버라이드해 미세
   * 조정할 수도 있다.
   */
  illustFilter?: string;
  /**
   * 일러스트 PNG 의 mix-blend-mode. 사용자가 투명 배경 PNG 를 쓰면 'normal'
   * 이면 충분하지만, 흰/크림 배경 PNG 를 그대로 쓸 경우 라이트 테마에서
   * 'multiply' 가 자연스럽게 배경을 녹여낸다.
   * --mw-illust-blend 변수로 노출.
   */
  illustBlend?: string;
}

// 펄 — 부드러운 라디얼 그라디언트로 진주빛 광택. 어디에나 무난.
const PEARL_PATTERN =
  'radial-gradient(circle at 30% 20%, rgba(255,230,235,0.55) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 75% 70%, rgba(220,235,255,0.5) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 50% 50%, rgba(255,250,240,0.35) 0%, rgba(255,255,255,0) 60%)';

// 편지지 — 박엽지·캔버스 같은 따뜻한 흰 바탕에 미세한 섬유결과 얼룩.
// 라디얼로 자연스러운 변색, 반복 라인으로 종이 결을 더한다.
const LETTER_PAPER_PATTERN =
  'radial-gradient(circle at 18% 22%, rgba(214,193,160,0.18) 0%, rgba(255,255,255,0) 28%), ' +
  'radial-gradient(circle at 78% 65%, rgba(196,176,148,0.16) 0%, rgba(255,255,255,0) 32%), ' +
  'radial-gradient(circle at 45% 85%, rgba(220,200,170,0.12) 0%, rgba(255,255,255,0) 36%), ' +
  'repeating-linear-gradient(118deg, rgba(165,135,95,0.045) 0px, rgba(165,135,95,0.045) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 5px), ' +
  'repeating-linear-gradient(32deg, rgba(165,135,95,0.03) 0px, rgba(165,135,95,0.03) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 7px)';

// 샴페인 — 웜 아이보리 위에 옅은 골드 광택의 부드러운 라디얼.
const CHAMPAGNE_PATTERN =
  'radial-gradient(circle at 25% 25%, rgba(212,165,116,0.22) 0%, rgba(255,248,235,0) 42%), ' +
  'radial-gradient(circle at 80% 70%, rgba(232,200,160,0.18) 0%, rgba(255,248,235,0) 45%)';

// 일러스트 PNG 가 흰/크림 배경 위에 그려져 있어도 모든 테마에서 배경이
// 사라진 것처럼 보이게 하는 두 가지 전략:
//   - 라이트 테마: mix-blend-mode 'multiply' — 흰 배경이 곱해져 테마 bg 와
//     동화되고, 짙은 라인 아트만 남는다.
//   - 다크 테마:  filter 로 명도 반전 + mix-blend-mode 'screen' — 반전된
//     이미지에서 (원래 흰 배경 → 검정) 부분이 screen 으로 사라지고,
//     (원래 라인 → 흰색) 부분만 남아 다크 bg 위에서도 잘 보인다.
const LIGHT_ILLUST_BLEND = 'multiply';
const DARK_ILLUST_FILTER = 'invert(0.95) hue-rotate(180deg)';
const DARK_ILLUST_BLEND = 'screen';

export const THEME_PALETTES: Record<ColorTheme, Palette> = {
  cream: {
    bg: '#FAF7F2',
    fg: '#3D2E1F',
    accent: '#8B7355',
    dot: '#D4C5B0',
    petals: ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'],
    illustBlend: LIGHT_ILLUST_BLEND,
  },
  blush: {
    bg: '#FFF4F1',
    fg: '#5C2A2E',
    accent: '#C9748E',
    dot: '#E5B8BD',
    petals: ['#FFD1D9', '#FFB6C1', '#FFC0CB', '#FFE4E1'],
    illustBlend: LIGHT_ILLUST_BLEND,
  },
  sage: {
    bg: '#F1F5EE',
    fg: '#2D4A33',
    accent: '#658067',
    dot: '#C8D5C0',
    petals: ['#C4D9C0', '#A8C5A1', '#D5E5CD', '#B3CFA8'],
    illustBlend: LIGHT_ILLUST_BLEND,
  },
  dusk: {
    bg: '#221C2E',
    fg: '#F5E9D0',
    accent: '#D4B5A0',
    dot: '#5C4F75',
    petals: ['#B8A6D6', '#D4A5DC', '#DDD0EB', '#E8D5F2'],
    illustFilter: DARK_ILLUST_FILTER,
    illustBlend: DARK_ILLUST_BLEND,
  },
  // 펄 — 진주빛 배경 위에 남색 계열 글씨로 정갈한 톤.
  pearl: {
    bg: '#F8F4EE',
    fg: '#1A2238',
    accent: '#2C3E5C',
    dot: '#B5BCC9',
    petals: ['#F5E1DA', '#E8D0C8', '#FFFFFF', '#EFD9D2'],
    bgPattern: PEARL_PATTERN,
    illustBlend: LIGHT_ILLUST_BLEND,
  },
  // 편지지 — 박엽지/캔버스 질감의 따뜻한 흰 바탕에 검정 글자.
  // 결혼 청첩장 정통 톤. 글자는 또렷한 잉크 검정.
  letterPaper: {
    bg: '#F7F2E8',
    fg: '#1A1A1A',
    accent: '#5A4632',
    dot: '#C9B59A',
    petals: ['#F0E2C8', '#E5D5B8', '#FFFFFF', '#F5EBD8'],
    bgPattern: LETTER_PAPER_PATTERN,
    illustBlend: LIGHT_ILLUST_BLEND,
  },
  // 미드나잇 — 검정 배경 + 밝은 샴페인 글자. 모던/세련.
  midnight: {
    bg: '#0F0F12',
    fg: '#F2E8D5',
    accent: '#D4AF7F',
    dot: '#3A3A42',
    petals: ['#E8D5A8', '#D4AF7F', '#F5E9C8', '#C9A66B'],
    illustFilter: DARK_ILLUST_FILTER,
    illustBlend: DARK_ILLUST_BLEND,
  },
  // 샴페인 — 웜 아이보리 + 딥 와인 글자 + 골드 액센트.
  // 결혼 분위기 풀로 살리고 글자 가독성도 강한 조합.
  champagne: {
    bg: '#FFF8EE',
    fg: '#3D1F22',
    accent: '#B8915A',
    dot: '#E5CDA8',
    petals: ['#F5DCC4', '#E8C8A8', '#FFEFD8', '#D4B58F'],
    bgPattern: CHAMPAGNE_PATTERN,
    illustBlend: LIGHT_ILLUST_BLEND,
  },
};

export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  cream: '크림',
  blush: '블러쉬',
  sage: '세이지',
  dusk: '더스크',
  pearl: '펄',
  letterPaper: '편지지',
  midnight: '미드나잇',
  champagne: '샴페인',
};

// 'flower'/'heart'/'star' 는 글리프(2D), 'sakura'/'leaf'/'whitePetal' 은 텍스처형.
// 'whitePetal' 은 photo-realistic 에 가까운 SVG로 한 잎씩 흩날리는 흰 꽃잎.
export const PETAL_TYPES = [
  'flower',
  'heart',
  'star',
  'sakura',
  'leaf',
  'whitePetal',
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
  whitePetal: '',
  none: '',
};

export const PETAL_LABELS: Record<PetalType, string> = {
  flower: '꽃잎',
  heart: '하트',
  star: '별',
  sakura: '벚꽃잎 (질감)',
  leaf: '단풍잎 (질감)',
  whitePetal: '흰 꽃잎 (실사풍)',
  none: '없음',
};

/** SVG 텍스처 효과 여부. true 인 키는 FallingPetals 가 SVG 로 렌더링. */
export const PETAL_IS_TEXTURE: Record<PetalType, boolean> = {
  flower: false,
  heart: false,
  star: false,
  sakura: true,
  leaf: true,
  whitePetal: true,
  none: false,
};

// 폰트 키 — 새 키를 끝에 추가만 하고 기존 키는 그대로 둬서 저장된
// invitation 데이터의 호환성을 깨지 않는다.
export const FONT_KEYS = [
  // 명조 / 고딕 계열
  'serif',
  'sans',
  'nanumGothic',
  'nanumSquare',
  'pretendard',
  'gmarket',
  'gowun',
  'jeju',
  'songMyung',
  // 손글씨 / 캘리 계열
  'handwritten',
  'nanumPen',
  'nanumBrush',
  'kimjungchul',
  'gabiaMaeum',
  'gabiaNul',
  'gabiaHeuldot',
  'gabiaGosran',
  'gabiaCheongyeon',
  'dokdo',
  'gabiaBombaram',
  'gabiaDunn',
  'kyobo2025lyb',
  'kyobo2023wsa',
  'kyobo2022khn',
  'kyobo2020pdy',
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export interface FontOption {
  label: string;
  family: string;
}

/**
 * Font family 문자열.
 *
 * Google Fonts 계열은 모두 next/font/google 가 layout.tsx 에서 자동 로드
 * + 자체 호스팅하며, 각 폰트가 노출하는 CSS 변수를 family 첫 후보로 둔다.
 * (예: --font-noto-sans-kr → 빌드 타임에 Next.js 가 발급한 실제 폰트 패밀리
 *  이름으로 치환된다.) 변수 미설정/폰트 로드 실패 시 뒤따르는 한글 폴백
 *  → 일반 폴백 순으로 자연스럽게 내려간다.
 *
 * Pretendard 만 globals.css 의 JSDelivr @import 로 로드한다.
 *
 * HIDDEN_FONT_KEYS 의 폰트는 안정적인 무료 호스팅이 없어 picker 에 노출되지
 * 않는다 — family 는 의미상 가장 가까운 Google Font 의 변수로 폴백시켜
 * 기존 저장 데이터가 있어도 깨지지 않게 한다.
 */
export const FONT_OPTIONS: Record<FontKey, FontOption> = {
  // ── 명조 / 고딕 ──────────────────────────────────────
  serif: { label: '명조', family: "var(--font-noto-serif-kr), serif" },
  sans: { label: '본고딕', family: "var(--font-noto-sans-kr), sans-serif" },
  nanumGothic: {
    label: '나눔고딕',
    family: "var(--font-nanum-gothic), var(--font-noto-sans-kr), sans-serif",
  },
  nanumSquare: {
    // HIDDEN — 로컬 파일 활성화 시 family 를 아래로 교체:
    //   "var(--font-nanum-square), var(--font-noto-sans-kr), sans-serif"
    label: '나눔스퀘어',
    family: "var(--font-nanum-square), var(--font-noto-sans-kr), sans-serif",
  },
  pretendard: {
    label: '프리텐다드',
    family: "'Pretendard', var(--font-noto-sans-kr), sans-serif",
  },
  gmarket: {
    // HIDDEN — 로컬 파일 활성화 시 family 를 아래로 교체:
    //   "var(--font-gmarket), var(--font-noto-sans-kr), sans-serif"
    label: 'G마켓 산스',
    family: "var(--font-gmarket), var(--font-noto-sans-kr), sans-serif",
  },
  gowun: { label: '고운바탕', family: "var(--font-gowun-batang), serif" },
  jeju: {
    // Google Fonts CSS @import 로 로드 (next/font/google 14.2 미지원)
    label: '제주명조',
    family: "'Jeju Myeongjo', var(--font-noto-serif-kr), serif",
  },
  songMyung: {
    label: '송명',
    family: "var(--font-song-myung), var(--font-noto-serif-kr), serif",
  },

  // ── 손글씨 / 캘리 ────────────────────────────────────
  handwritten: { label: '손글씨', family: "var(--font-gaegu), cursive" },
  nanumPen: {
    label: '나눔손글씨 펜',
    family: "var(--font-nanum-pen), cursive",
  },
  nanumBrush: {
    label: '나눔손글씨 붓',
    family: "var(--font-nanum-brush), cursive",
  },
  kyobo2025lyb: {
    // HIDDEN — 활성화 시 family: "var(--font-kyobo-2025lyb), cursive"
    label: '교보 2025lyb',
    family: "var(--font-kyobo-2025lyb), cursive",
  },
  kyobo2023wsa: {
    // HIDDEN — 활성화 시 family: "var(--font-kyobo-2023wsa), cursive"
    label: '교보 2023wsa',
    family: "var(--font-kyobo-2023wsa), cursive",
  },
  kyobo2022khn: {
    // HIDDEN — 활성화 시 family: "var(--font-kyobo-2022khn), cursive"
    label: '교보 2022khn',
    family: "var(--font-kyobo-2022khn), cursive",
  },
  kyobo2020pdy: {
    // HIDDEN — 활성화 시 family: "var(--font-kyobo-2020pdy), cursive"
    label: '교보 2020pdy',
    family: "var(--font-kyobo-2020pdy), cursive",
  },
  kimjungchul: {
    // HIDDEN — 활성화 시 family: "var(--font-kimjungchul), serif"
    label: '김정철 손글씨',
    family: "var(--font-kimjungchul), sans-serif",
  },
  gabiaMaeum: {
    family: "var(--font-gabia-maeum), serif",
    label: '가비아 마음결',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaNul: {
    family: "var(--font-gabia-nul), serif",
    label: '가비아 눌체',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaHeuldot: {
    family: "var(--font-gabia-heuldot), serif",
    label: '가비아 흘돋체',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaGosran: {
    family: "var(--font-gabia-gosran), serif",
    label: '가비아 고스란체',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaCheongyeon: {
    family: "var(--font-gabia-cheongyeon), serif",
    label: '가비아 청연',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaBombaram: {
    family: "var(--font-gabia-bombaram), serif",
    label: '가비아 봄바람체',
    //family: "var(--font-gowun-batang), serif",
  },
  gabiaDunn: {
    family: "var(--font-gabia-dunn), serif",
    label: '가비아 던체',
    //family: "var(--font-gowun-batang), serif",
  },
  // 붓펜 느낌의 한글 필기체 — 손글씨(Gaegu)와는 결이 다름.
  dokdo: { label: '캘리', family: "var(--font-dokdo), cursive" },
};

// ── 영문 장식 폰트 (메인 풀이미지형 제목 전용) ──────────────
// Title-only picker. 글로벌 테마 폰트(FONT_KEYS)와는 별도 도메인이라
// FontKey에 섞지 않고 별도 enum으로 둔다 — 데이터 호환성 + UI 분리.

export const TITLE_FONT_KEYS = [
  'playfairDisplay',
  'montserrat',
  'ebGaramond',
  'fraunces',
  'greatVibes',
  'pinyonScript',
] as const;
export type TitleFontKey = (typeof TITLE_FONT_KEYS)[number];

export const TITLE_FONT_OPTIONS: Record<TitleFontKey, FontOption> = {
  playfairDisplay: {
    label: 'Playfair Display',
    family: "var(--font-playfair-display), serif",
  },
  montserrat: {
    label: 'Montserrat',
    family: "var(--font-montserrat), sans-serif",
  },
  ebGaramond: {
    label: 'EB Garamond',
    family: "var(--font-eb-garamond), serif",
  },
  fraunces: {
    label: 'Fraunces',
    family: "var(--font-fraunces), serif",
  },
  greatVibes: {
    label: 'Great Vibes',
    family: "var(--font-great-vibes), cursive",
  },
  pinyonScript: {
    label: 'Pinyon Script',
    family: "var(--font-pinyon-script), cursive",
  },
};

// 콤보박스 프리셋 — 사용자는 이 중 선택하거나 직접 입력 가능.
export const TITLE_TEXT_PRESETS = [
  'We are getting married',
  'our wedding day',
  'Our Story Begins Here',
  'The Beginning of Us',
  'A day, our way',
  'You & Me',
  'Save the Date',
  'Love, always',
  'Love, Laughter, Forever',
] as const;

/**
 * picker 에 노출하지 않는 폰트 키.
 * 안정적인 무료 호스팅 URL 이 없어 임시로 숨김 — `docs/local-fonts-guide.md`
 * 의 절차대로 .woff2 파일을 `src/app/fonts/korean/` 에 두고
 * `src/app/layout.tsx` 의 LOCAL KOREAN FONTS 블록을 활성화한 뒤,
 * 해당 키를 이 Set 에서 제거하면 picker 에 노출된다.
 *
 * 키 자체는 FONT_KEYS 에 남겨두기 때문에 기존에 저장된 invitation 의
 * font 값(예: 'gabiaMaeum')은 Zod 검증을 통과하고, 위 FONT_OPTIONS 에
 * 정의한 폴백 폰트로 렌더된다.
 */
export const HIDDEN_FONT_KEYS = new Set<FontKey>([
  'dokdo'

]);

/** picker 에 노출되는 키만 모아둔 배열 — 편집기는 이 목록만 보여준다. */
export const AVAILABLE_FONT_KEYS: readonly FontKey[] = FONT_KEYS.filter(
  (k) => !HIDDEN_FONT_KEYS.has(k),
);

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
