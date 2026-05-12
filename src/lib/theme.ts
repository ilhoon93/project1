/**
 * Visual theme presets for published invitations.
 * Schema in invitation.ts stores the chosen *keys*; this file maps keys to actual values.
 */

// 라이트 테마를 앞에, 다크 테마(dusk / midnight)는 마지막 두 자리에 배치 —
// picker 를 열면 자연스럽게 자주 쓰이는 라이트 톤부터 보이고 다크는
// 끝에 모여 있다.
export const COLOR_THEMES = [
  'cream',
  'blush',
  'sage',
  'lavender',    // 라벤더 — 연보라 톤. 별빛/오로라 효과와 잘 어울림.
  'sky',         // 하늘 — 맑은 날 하늘 그라데이션 + 옅은 구름 텍스처.
  'pearl',
  'letterPaper', // 편지지 — 흰 바탕 + 검정 글자
  'champagne',   // 샴페인 — 웜 아이보리 + 와인 글자
  'rose',        // 더스티 로즈 — 핑크 바탕 + 모카 글자 (로맨틱)
  'forest',      // 포레스트 — 아이보리 + 딥 그린 (보태니컬)
  'charcoal',    // 차콜 — 웜 오프화이트 + 차콜 + 코퍼 (모던 미니멀)
  'dusk',        // 더스크 — 다크 보랏빛
  'midnight',    // 미드나잇 — 검정 배경 + 밝은 샴페인
  'navy',        // 네이비 — 딥 네이비 + 샴페인 골드 (클래식)
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
}

// 펄 — 부드러운 라디얼 그라디언트로 진주빛 광택. 어디에나 무난.
const PEARL_PATTERN =
  'radial-gradient(circle at 30% 20%, rgba(255,230,235,0.55) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 75% 70%, rgba(220,235,255,0.5) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 50% 50%, rgba(255,250,240,0.35) 0%, rgba(255,255,255,0) 60%)';

// 편지지는 패턴 없이 평면 흰 바탕만 사용 — 모바일 환경에서 화면 밝기에
// 따라 광택 얼룩이 회색으로 비치는 문제가 있어 BG_PATTERN 을 따로 두지 않는다.

// 샴페인 — 웜 아이보리 위에 옅은 골드 광택의 부드러운 라디얼.
const CHAMPAGNE_PATTERN =
  'radial-gradient(circle at 25% 25%, rgba(212,165,116,0.22) 0%, rgba(255,248,235,0) 42%), ' +
  'radial-gradient(circle at 80% 70%, rgba(232,200,160,0.18) 0%, rgba(255,248,235,0) 45%)';

// 하늘 — 맑은 한낮의 하늘. 위에서 아래로 푸른 톤이 점점 옅어지는 수직
// 그라데이션 위에, 듬성듬성한 흰 구름 같은 라디얼 글로우 3개를 얹어
// 단색이 아닌 자연스러운 하늘 느낌을 낸다. 낮 → 지평선 방향 그라데이션은
// 맨 마지막에 두어 stack 의 가장 아래 깔리도록 한다 (위쪽 라디얼들이 구름).
const SKY_PATTERN =
  // 부드러운 흰 구름 패치 — 가장자리 흐림을 위해 알파 fade.
  'radial-gradient(ellipse 55% 30% at 22% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%), ' +
  'radial-gradient(ellipse 45% 25% at 78% 38%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%), ' +
  'radial-gradient(ellipse 50% 22% at 50% 78%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%), ' +
  // 수직 하늘 그라데이션 — 위(좀 더 진한 푸른 하늘) → 아래(밝은 지평선).
  'linear-gradient(to bottom, #B5D4EE 0%, #CFE3F4 35%, #E5EFF8 70%, #F5F8FB 100%)';

// 일러스트 PNG 는 *투명 배경* 으로 저장하는 것을 전제로 한다 — 그렇지 않으면
// 색상 필터로는 신랑·신부의 흰 드레스/피부/연한 꽃 같은 밝은 톤 요소들과
// 배경(흰/크림)을 구분할 수 없다. (luminance 만으로는 공간적으로 같은 색을
// 가진 영역을 분리하지 못하기 때문.)
//
// 따라서 라이트 테마에선 어떤 필터도 적용하지 않고, 다크 테마(dusk/midnight)
// 에선 짙은 라인이 어두운 바탕에서도 보이도록 drop-shadow 두 겹 글로우만
// 더한다. 투명 PNG 라면 글로우는 figure 외곽선 주변에 자연스럽게 깔린다.
const DARK_ILLUST_FILTER =
  'drop-shadow(0 0 1.5px rgba(255,255,255,0.55)) drop-shadow(0 0 4px rgba(255,255,255,0.18))';

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
  // 라벤더 — 은은한 연보라 배경에 짙은 보랏빛 글자.
  // 별빛/오로라 배경 효과와 결이 잘 맞는 톤이라 같은 업데이트에 함께 추가.
  lavender: {
    bg: '#F4EFFA',
    fg: '#3F2E5C',
    accent: '#8E6FBF',
    dot: '#D7C9EA',
    petals: ['#E2D2F2', '#C9B5E5', '#EFE4F8', '#B89BD9'],
  },
  // 하늘 — 푸른 그라데이션 + 옅은 구름. 텍스트는 짙은 네이비로 가독성 확보.
  sky: {
    bg: '#CFE3F4',
    fg: '#1E3A5F',
    accent: '#4F86B8',
    dot: '#B7D2E8',
    petals: ['#FFFFFF', '#E8F2FA', '#D2E4F2', '#BCD6EC'],
    bgPattern: SKY_PATTERN,
  },
  dusk: {
    bg: '#221C2E',
    fg: '#F5E9D0',
    accent: '#D4B5A0',
    dot: '#5C4F75',
    petals: ['#B8A6D6', '#D4A5DC', '#DDD0EB', '#E8D5F2'],
    illustFilter: DARK_ILLUST_FILTER,
  },
  // 펄 — 진주빛 배경 위에 남색 계열 글씨로 정갈한 톤.
  pearl: {
    bg: '#F8F4EE',
    fg: '#1A2238',
    accent: '#2C3E5C',
    dot: '#B5BCC9',
    petals: ['#F5E1DA', '#E8D0C8', '#FFFFFF', '#EFD9D2'],
    bgPattern: PEARL_PATTERN,
  },
  // 편지지 — 패턴 없는 깔끔한 순백 + 잉크 검정 글자. 결혼 청첩장 클래식 톤.
  // 배경 효과 색은 흰 바탕에서 잘 보이도록 *부드러운 분홍 톤* 으로 — 하얀
  // 꽃잎/눈송이 글리프는 흰 바탕에서 사실상 안 보이는 문제 해결. 글자/액센트
  // 자체는 검정 잉크 톤이라 핑크 효과가 청첩장 분위기와 자연스럽게 어울림.
  letterPaper: {
    bg: '#FFFFFF',
    fg: '#1A1A1A',
    accent: '#3D3D3D',
    dot: '#D4D4D4',
    petals: ['#FFD1D9', '#FFC0CB', '#FFE4EC', '#F4C2C8'],
  },
  // 미드나잇 — 검정 배경 + 밝은 샴페인 글자. 모던/세련.
  midnight: {
    bg: '#0F0F12',
    fg: '#F2E8D5',
    accent: '#D4AF7F',
    dot: '#3A3A42',
    petals: ['#E8D5A8', '#D4AF7F', '#F5E9C8', '#C9A66B'],
    illustFilter: DARK_ILLUST_FILTER,
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
  },
  // 더스티 로즈 — 옅은 핑크 바탕 + 모카 브라운 글자. 따뜻하고 부드러운
  // 로맨틱 톤. 작약·장미 같은 클래식 꽃과 잘 어울림.
  rose: {
    bg: '#F5E1DC',
    fg: '#5C3D2E',
    accent: '#B88670',
    dot: '#E8C8B8',
    petals: ['#FFD9CE', '#E8C8B8', '#FFFFFF', '#D4A088'],
  },
  // 포레스트 — 아이보리 위에 딥 그린 글자. 식물·꽃 일러스트와 자연스럽게
  // 어울리는 보태니컬 톤. 야외/정원 컨셉 예식에 어울림.
  forest: {
    bg: '#F5EFE0',
    fg: '#2D4A2B',
    accent: '#6B8E5C',
    dot: '#C9D2BD',
    petals: ['#E8E2D0', '#C9D2BD', '#FFFFFF', '#B5C8A8'],
  },
  // 차콜 — 웜 오프화이트 + 차콜 글자 + 코퍼/구리 액센트. 모던하고 도시적인
  // 미니멀 톤. 산세리프 폰트와 깔끔하게 매치.
  charcoal: {
    bg: '#F5F2ED',
    fg: '#2A2A2D',
    accent: '#C97D5C',
    dot: '#D8D2C8',
    petals: ['#F5E1D0', '#E8C8A8', '#FFFFFF', '#D4A88A'],
  },
  // 네이비 — 딥 네이비 배경 + 샴페인 골드 글자. 가장 클래식하고 격조 있는
  // 웨딩 톤. 야외/저녁 예식에 잘 어울리고 모든 폰트에서 가독성이 우수.
  navy: {
    bg: '#0D1F3A',
    fg: '#F5E9C8',
    accent: '#C9A66B',
    dot: '#2C3E5C',
    petals: ['#E8D5A8', '#C9A66B', '#F5E9C8', '#D4AF7F'],
    illustFilter: DARK_ILLUST_FILTER,
  },
};

export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  cream: '크림',
  blush: '블러쉬',
  sage: '세이지',
  lavender: '라벤더',
  sky: '하늘',
  dusk: '더스크',
  pearl: '펄',
  letterPaper: '편지지',
  midnight: '미드나잇',
  champagne: '샴페인',
  rose: '로즈',
  forest: '포레스트',
  charcoal: '차콜',
  navy: '네이비',
};

// 'flower'/'heart'/'star'/'snow' 는 글리프(이모지/문자) 효과,
// 'sakura'/'leaf'/'whitePetal' 은 SVG 텍스처. 'bokeh'/'starlight' 은
// "떨어지는" 효과가 아니라 화면 위에서 페이드되는 별도 분기.
//
// leaf 는 🍁 모양을 따르는 SVG 로 구현 — 이모지 글리프는 색이 고정이라
// 테마 색을 못 받지만, SVG 는 currentColor 로 채워 테마 팔레트가 그대로 적용됨.
export const PETAL_TYPES = [
  'flower',
  'heart',
  'star',
  'snow',         // ❄ — 눈송이
  'sakura',
  'leaf',         // 🍁 모양 SVG (테마 색상 반영)
  'whitePetal',
  'bokeh',        // 보케 — 큰 블러 원이 페이드 인/아웃
  'starlight',    // 별빛 — 트윙클 + 오로라
  'none',
] as const;
export type PetalType = (typeof PETAL_TYPES)[number];

/** 글리프형(폰트 문자) 효과만 매핑. SVG형/특수 분기는 FallingPetals 컴포넌트가 직접 그림. */
export const PETAL_GLYPHS: Record<PetalType, string> = {
  flower: '❀',
  heart: '♥',
  star: '★',
  snow: '❄',
  sakura: '',
  leaf: '',
  whitePetal: '',
  bokeh: '',
  starlight: '',
  none: '',
};

export const PETAL_LABELS: Record<PetalType, string> = {
  flower: '꽃잎',
  heart: '하트',
  star: '별',
  snow: '눈송이',
  sakura: '벚꽃잎 (질감)',
  leaf: '단풍잎',
  whitePetal: '흰 꽃잎 (실사풍)',
  bokeh: '보케 (드림라이트)',
  starlight: '별빛 (오로라)',
  none: '없음',
};

/** SVG 텍스처 효과 여부. true 인 키는 FallingPetals 가 SVG 로 렌더링. */
export const PETAL_IS_TEXTURE: Record<PetalType, boolean> = {
  flower: false,
  heart: false,
  star: false,
  snow: false,
  sakura: true,
  leaf: true,
  whitePetal: true,
  // bokeh/starlight 은 자체 렌더 분기를 사용.
  bokeh: false,
  starlight: false,
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
  // nanumPen / nanumBrush 는 picker 에서 숨김 처리(HIDDEN_FONT_KEYS) 되어 있고,
  // 로더(layout.tsx) 도 제거됐다. 키 자체는 FONT_KEYS 에 남겨 기존 저장된
  // 알림장(theme.font 값) 이 z.enum 검증에서 깨지지 않게 함. family 는 폴백 한글
  // 손글씨 폰트로 매핑.
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
  sans: { label: '본고딕', family: "var(--font-noto-sans-kr), sans-serif" }, // 히든
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
  handwritten: { label: '손글씨', family: "var(--font-gaegu), cursive" }, // 히든
  // 두 폰트는 picker 에서 제외(HIDDEN) + layout.tsx 의 next/font/google 로더도
  // 제거. 기존 저장 데이터가 'nanumPen' / 'nanumBrush' 를 가져도 zod 통과하도록
  // 키만 보존하고 family 는 가장 가까운 한글 손글씨 폰트로 폴백.
  nanumPen: {
    label: '나눔손글씨 펜',
    family: "var(--font-gaegu), cursive",
  },
  nanumBrush: {
    label: '나눔손글씨 붓',
    family: "var(--font-gowun-batang), serif",
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
  dokdo: { label: '캘리', family: "var(--font-dokdo), cursive" }, // 히든
};

// ── 영문 장식 폰트 (메인 풀이미지형 제목 전용) ──────────────
// Title-only picker. 글로벌 테마 폰트(FONT_KEYS)와는 별도 도메인이라
// FontKey에 섞지 않고 별도 enum으로 둔다 — 데이터 호환성 + UI 분리.
//
// 한글 문구가 선택되면 영문 장식 폰트는 한글 글리프를 가지고 있지 않아
// 시스템 폴백으로 떨어지면서 텍스트형/일러스트형의 분위기를 잃는다.
// → TITLE_FONT_KEYS_KO 에 한글에서 잘 보이는 폰트들을 별도로 정의해두고,
// 메인 에디터의 FontPicker 는 제목 텍스트의 언어를 감지해 둘 중 하나의
// 목록만 보여준다. 두 목록의 키는 서로 겹치지 않아 z.enum 하나로 통합 가능.

export const TITLE_FONT_KEYS_EN = [
  'playfairDisplay',
  'montserrat',
  'ebGaramond',
  'fraunces',
  'greatVibes',
  'pinyonScript',
] as const;
export type TitleFontKeyEn = (typeof TITLE_FONT_KEYS_EN)[number];

// 한글 제목 폰트 — globals.css / next/font 로 이미 로드돼 있는 한글 폰트 중
// 청첩장 제목에 잘 어울리는 우아한 명조·고운바탕 계열을 추렸다.
export const TITLE_FONT_KEYS_KO = [
  'koSerif',         // 명조 — Noto Serif KR
  'koGowun',         // 고운바탕 — 부드러운 세리프
  'koSongMyung',     // 송명 — 클래식 명조
  'koJeju',          // 제주명조 — 살짝 손글씨 느낌
  'koGabiaGosran',   // 가비아 고스란체 — 가는 명조
  'koGabiaCheongyeon', // 가비아 청연 — 캘리 느낌
] as const;
export type TitleFontKeyKo = (typeof TITLE_FONT_KEYS_KO)[number];

// 통합 enum — 데이터 호환성 + zod 스키마 단일화 용도.
// 기존 저장된 invitation 의 font 값('playfairDisplay' 등) 그대로 통과.
export const TITLE_FONT_KEYS = [
  ...TITLE_FONT_KEYS_EN,
  ...TITLE_FONT_KEYS_KO,
] as const;
export type TitleFontKey = (typeof TITLE_FONT_KEYS)[number];

export const TITLE_FONT_OPTIONS: Record<TitleFontKey, FontOption> = {
  // 영문
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
  // 한글 — FONT_OPTIONS 의 family 와 동일한 변수를 그대로 사용한다.
  koSerif: { label: '명조', family: "var(--font-noto-serif-kr), serif" },
  koGowun: { label: '고운바탕', family: "var(--font-gowun-batang), serif" },
  koSongMyung: {
    label: '송명',
    family: "var(--font-song-myung), var(--font-noto-serif-kr), serif",
  },
  koJeju: {
    label: '제주명조',
    family: "'Jeju Myeongjo', var(--font-noto-serif-kr), serif",
  },
  koGabiaGosran: {
    label: '가비아 고스란체',
    family: "var(--font-gabia-gosran), var(--font-noto-serif-kr), serif",
  },
  koGabiaCheongyeon: {
    label: '가비아 청연',
    family: "var(--font-gabia-cheongyeon), var(--font-noto-serif-kr), serif",
  },
};

/** 한글 문구 자동 적용 시 기본으로 세팅할 한글 폰트 키. */
export const DEFAULT_TITLE_FONT_KO: TitleFontKeyKo = 'koGowun';
/** 영문 문구 기본 폰트 키. */
export const DEFAULT_TITLE_FONT_EN: TitleFontKeyEn = 'playfairDisplay';

/**
 * 텍스트에 한글(가-힣 / 자음 / 모음)이 포함돼 있으면 true.
 * 빈 문자열이거나 한글이 한 글자도 없으면 false.
 */
export function isKoreanTitleText(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[ㄱ-ㆎ가-힣]/.test(text);
}

/** 한 폰트 키가 한글 그룹 소속인지 여부. */
export function isKoreanTitleFontKey(key: string): key is TitleFontKeyKo {
  return (TITLE_FONT_KEYS_KO as readonly string[]).includes(key);
}

// 콤보박스 프리셋 — 사용자는 이 중 선택하거나 직접 입력 가능.
// 마지막에 한글 프리셋 추가 — 한글 선택 시 에디터가 자동으로
// 한글 폰트 목록으로 전환한다.
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
  '우리 결혼합니다',
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
  'dokdo',
  'handwritten',
  'sans',
  // 사용자 요청으로 picker 에서 제외 — 키/family 폴백은 보존(기존 저장 데이터 호환).
  'nanumPen',
  'nanumBrush',
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
