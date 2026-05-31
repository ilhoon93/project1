import {
  defaultInvitationContent,
  type InvitationContent,
} from '@/types/invitation';
import {
  COLOR_THEME_LABELS,
  PETAL_LABELS,
  type ColorTheme,
  type PetalType,
  type FontKey,
} from '@/lib/theme';

/**
 * 마케팅용 알림장 디자인 샘플 + 메인 Before/After 슬라이더 + 공유 본문 템플릿의
 * 단일 소스. 운영자(/admin/home-samples) 가 모두 편집 가능하고, 값이 없으면
 * 이 파일의 코드 기본값으로 폴백한다.
 *
 *   DesignConfig.main   = 실제 InvitationContent['main'] (에디터 수준 표지 편집)
 *   TemplateConfig      = 모든 샘플이 공유하는 본문(스토리/갤러리/퀴즈 등)
 *   BeforeAfterConfig   = AI 스냅 Before/After 슬라이더의 before 사진 + 4 스타일
 *
 * 이미지 url 검증을 피하기 위해 스키마상 url 인 필드(heroImage, story.chapters.image,
 * gallery.images)는 catalog id 로 저장하고 buildDesign 시점에 경로로 주입한다.
 */

const CAT = '/wedding-snap/catalog';

// ─────────────────────────────────────────────────────────────
// 1. 타입
// ─────────────────────────────────────────────────────────────

export interface SampleDesign {
  id: string;
  name: string;
  layoutLabel: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  content: InvitationContent;
}

export interface DesignConfig {
  id: string;
  enabled: boolean;
  name: string;
  layoutLabel: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  heroImageId: string;
  main: InvitationContent['main'];
}

export interface AiSnapItem {
  id: string;
  label: string;
  src: string;
}

export interface BeforeAfterStyle {
  id: string;
  /**
   * 어떤 카탈로그 스타일을 적용한 결과인지. label/afterLabel 자동 채움 + Pricing
   * 카드에서 "이 스타일을 쓰면 N장 무료 체험" 같은 안내에 사용. 비어 있으면 id
   * 가 카탈로그 id 로 가정 (구버전 호환).
   */
  styleCatalogId?: string;
  label: string;
  afterLabel: string;
  /**
   * 결과(After) 이미지 경로. 운영자가 입력사진을 그 카탈로그 스타일로 생성한
   * 실제 결과물을 storage 에 업로드해 그 url 을 저장. 카탈로그 마스터 자체가
   * 아니라 "사용자 입력 + 카탈로그 = 합성 결과" 의 데모.
   */
  afterImage: string;
}

export interface BeforeAfterConfig {
  beforeImage: string;
  styles: BeforeAfterStyle[];
}

export interface TemplateChapter {
  title: string;
  text: string;
  /** catalog id (resolve to `/wedding-snap/catalog/{id}.jpg` at build). */
  imageId: string;
}

export interface TemplateConfig {
  basicGreeting: string;
  basicQuote: string;
  storyChapters: TemplateChapter[];
  galleryImageIds: string[];
  quizQuestion: string;
  quizOptions: string[]; // length 4
  quizAnswer: number; // 0-3
  /** 두 번째 퀴즈 (있을 때만). q 비우면 미노출. */
  quiz2Question: string;
  quiz2Options: string[];
  quiz2Answer: number;
  voteQuestion: string;
  voteOptions: string[]; // length 2
  /** 두 번째 투표 (있을 때만). q 비우면 미노출. */
  vote2Question: string;
  vote2Options: string[];
  /** 영상 슬라이드 — 제목 + URL(YouTube/Vimeo 등). url 비면 영상 슬라이드 미노출. */
  videoTitle: string;
  videoUrl: string;
  guestbookMessage: string;
  accountGuide: string;
  accountGroomBank: string;
  accountGroomNumber: string;
  accountBrideBank: string;
  accountBrideNumber: string;
  // 신랑·신부 부모 계좌 — 비우면(bank/number 둘 다 빈 문자열) 해당 항목 미노출.
  accountGroomFatherBank: string;
  accountGroomFatherNumber: string;
  accountGroomMotherBank: string;
  accountGroomMotherNumber: string;
  accountBrideFatherBank: string;
  accountBrideFatherNumber: string;
  accountBrideMotherBank: string;
  accountBrideMotherNumber: string;
  closing: string;
}

export interface HomeSamplesConfig {
  aiSnapCatalogIds: string[];
  designs: DesignConfig[];
  beforeAfter: BeforeAfterConfig;
  template: TemplateConfig;
}

// ─────────────────────────────────────────────────────────────
// 2. 기본값 — DB 미설정 시 폴백
// ─────────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE: TemplateConfig = {
  basicGreeting:
    '서로의 가장 가까운 친구가 되기로 했습니다.\n저희 두 사람의 새로운 시작을 함께 축복해 주세요.',
  basicQuote: '사랑은 함께 같은 곳을 바라보는 것.',
  storyChapters: [
    {
      title: '첫 만남',
      text: '우연히 같은 자리에 앉았던 그날, 서로를 알아본 순간부터 모든 게 시작됐어요.',
      imageId: 'studio-couple-puppy',
    },
    {
      title: '서로에게 물들다',
      text: '평범한 하루도 함께라 특별해졌습니다. 사계절을 나란히 걸으며 닮아갔어요.',
      imageId: 'garden-champagne-toast',
    },
    {
      title: '프로포즈',
      text: '오래 함께하고 싶다는 마음을 담아, 평생의 약속을 건넸습니다.',
      imageId: 'jeju-stonewall-cheer',
    },
  ],
  galleryImageIds: [
    'beach-classic-white',
    'paris-eiffel-walk',
    'hanbok-couple-studio',
    'cinema-redseat-couple',
    'yacht-sunset-hug',
    'countryside-bicycle-sunset',
  ],
  quizQuestion: '두 사람이 처음 만난 곳은?',
  quizOptions: ['대학교 동아리', '회사 워크샵', '소개팅 앱', '친구 소개'],
  quizAnswer: 0,
  quiz2Question: '두 사람의 첫 데이트 장소는?',
  quiz2Options: ['한강 공원', '경복궁', '코엑스 별마당', '제주도'],
  quiz2Answer: 0,
  voteQuestion: '신혼여행은 어디로 가면 좋을까요?',
  voteOptions: ['발리', '제주'],
  vote2Question: '신부의 부케 꽃은?',
  vote2Options: ['하얀 작약', '핑크 장미'],
  videoTitle: '우리의 프러포즈 영상',
  videoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  guestbookMessage: '축하 한마디와 서명을 남겨주세요!',
  accountGuide: '축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다.',
  accountGroomBank: '우리은행',
  accountGroomNumber: '1002-000-000000',
  accountBrideBank: '국민은행',
  accountBrideNumber: '123-00-000000',
  accountGroomFatherBank: '신한은행',
  accountGroomFatherNumber: '110-000-000000',
  accountGroomMotherBank: 'KB국민은행',
  accountGroomMotherNumber: '111-00-0000000',
  accountBrideFatherBank: '하나은행',
  accountBrideFatherNumber: '222-000000-00000',
  accountBrideMotherBank: 'NH농협',
  accountBrideMotherNumber: '333-0000-0000-00',
  closing: '와주셔서 진심으로 감사합니다',
};

export const DEFAULT_BEFORE_AFTER: BeforeAfterConfig = {
  beforeImage: '/wedding-snap/mode-examples/couple-input-1.jpg',
  styles: [
    {
      id: 'hanbok',
      label: '한복 스튜디오 핑크·라일락',
      afterLabel: 'AI · 한복 스튜디오 핑크·라일락',
      afterImage: `${CAT}/hanbok-couple-studio.jpg`,
    },
    {
      id: 'classic',
      label: '흑백 스튜디오 풀신',
      afterLabel: 'AI · 흑백 스튜디오 풀신',
      afterImage: `${CAT}/studio-couple-blackwhite.jpg`,
    },
    {
      id: 'outdoor',
      label: '가든 샴페인 토스트',
      afterLabel: 'AI · 가든 샴페인 토스트',
      afterImage: `${CAT}/garden-champagne-toast.jpg`,
    },
    {
      id: 'vintage',
      label: '90s 빈티지 거리 V사인',
      afterLabel: 'AI · 90s 빈티지 거리 V사인',
      afterImage: `${CAT}/vintage-90s-street-vsign.jpg`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// 3. buildDesign — Config + Template → 실제 InvitationContent
// ─────────────────────────────────────────────────────────────

export function buildDesign(
  c: DesignConfig,
  t: TemplateConfig = DEFAULT_TEMPLATE,
): SampleDesign {
  const content = defaultInvitationContent();

  content.theme.colorTheme = c.colorTheme;
  content.theme.petalType = c.petalType;
  content.theme.font = c.font;

  content.main = { ...c.main, heroImage: `${CAT}/${c.heroImageId}.jpg` };

  content.basic.greeting = { enabled: true, text: t.basicGreeting };
  content.basic.quote = { enabled: true, text: t.basicQuote };
  content.basic.family = {
    enabled: true,
    groomFather: { name: '김상현', deceased: false },
    groomMother: { name: '이정희', deceased: false },
    brideFather: { name: '박준호', deceased: false },
    brideMother: { name: '최은영', deceased: false },
  };

  content.story.chapters = t.storyChapters.map((ch) => ({
    title: ch.title,
    text: ch.text,
    image: ch.imageId ? `${CAT}/${ch.imageId}.jpg` : null,
  }));

  content.gallery = {
    enabled: true,
    layout: 'grid',
    images: t.galleryImageIds.map((id) => `${CAT}/${id}.jpg`),
  };

  const quizQs = [
    {
      q: t.quizQuestion,
      options: [t.quizOptions[0] ?? '', t.quizOptions[1] ?? '', t.quizOptions[2] ?? '', t.quizOptions[3] ?? ''],
      answer: Math.max(0, Math.min(3, t.quizAnswer)),
    },
  ];
  if (t.quiz2Question?.trim()) {
    quizQs.push({
      q: t.quiz2Question,
      options: [t.quiz2Options[0] ?? '', t.quiz2Options[1] ?? '', t.quiz2Options[2] ?? '', t.quiz2Options[3] ?? ''],
      answer: Math.max(0, Math.min(3, t.quiz2Answer ?? 0)),
    });
  }
  content.quiz = { enabled: true, questions: quizQs };

  const voteQs = [
    { q: t.voteQuestion, options: [t.voteOptions[0] ?? '', t.voteOptions[1] ?? ''] },
  ];
  if (t.vote2Question?.trim()) {
    voteQs.push({
      q: t.vote2Question,
      options: [t.vote2Options[0] ?? '', t.vote2Options[1] ?? ''],
    });
  }
  content.vote = { enabled: true, questions: voteQs };

  content.video = {
    enabled: !!t.videoUrl,
    title: t.videoTitle,
    url: t.videoUrl || null,
  };

  content.guestbook = { enabled: true, coupleMessage: t.guestbookMessage };

  content.account.guide = t.accountGuide;
  // 6 측(신랑/신부/양가 부모) 각각 — bank·number 가 모두 비어 있으면 빈 배열로
  // 두어 슬라이드에서 해당 측이 자동 숨김.
  const acct = (bank: string, number: string, holder: string) =>
    bank.trim() || number.trim() ? [{ bank, number, holder }] : [];
  content.account.groom = acct(t.accountGroomBank, t.accountGroomNumber, c.groomName);
  content.account.bride = acct(t.accountBrideBank, t.accountBrideNumber, c.brideName);
  content.account.groomFather = acct(t.accountGroomFatherBank, t.accountGroomFatherNumber, '신랑 아버지');
  content.account.groomMother = acct(t.accountGroomMotherBank, t.accountGroomMotherNumber, '신랑 어머니');
  content.account.brideFather = acct(t.accountBrideFatherBank, t.accountBrideFatherNumber, '신부 아버지');
  content.account.brideMother = acct(t.accountBrideMotherBank, t.accountBrideMotherNumber, '신부 어머니');

  content.closing = t.closing;

  // name/layoutLabel 은 항상 현재 데이터(컬러/레이아웃/배경효과) 기준 자동 생성.
  // 관리자에서 자동 생성된 값으로 저장하지만, 그 사이 코드 SEED 가 갱신되거나
  // 어떤 이유로 stale 값이 들어 있어도 렌더 시점에 한 번 더 보정해 일관성 보장.
  return {
    id: c.id,
    name: deriveSampleName(c),
    layoutLabel: deriveSampleLayoutLabel(c),
    groomName: c.groomName,
    brideName: c.brideName,
    weddingDate: c.weddingDate,
    content,
  };
}

const SAMPLE_LAYOUT_NAMES: Record<InvitationContent['main']['layout'], string> = {
  poster: '포스터',
  frame: '액자',
  polaroid: '액자',
  illustration: '일러스트',
  text: '텍스트',
};

const SAMPLE_PETAL_TAG: Partial<Record<PetalType, string>> = {
  none: '무효과',
  sakura: '벚꽃',
  flower: '꽃잎',
  leaf: '잎',
  heart: '하트',
  star: '별',
  starlight: '별빛',
  whitePetal: '흰 꽃잎',
  snow: '눈송이',
  bokeh: '보케',
};

function sampleLayoutName(layout: InvitationContent['main']['layout']): string {
  // 'polaroid' 레거시 → frame.
  const key = layout === 'polaroid' ? 'frame' : layout;
  return SAMPLE_LAYOUT_NAMES[key] ?? layout;
}

/** "크림 포스터" 같은 카드 이름 — 컬러 테마 + 레이아웃 기반 자동 생성. */
export function deriveSampleName(c: DesignConfig): string {
  const theme = COLOR_THEME_LABELS[c.colorTheme] ?? c.colorTheme;
  return `${theme} ${sampleLayoutName(c.main.layout)}`;
}

/** "포스터 · 벚꽃" 같은 태그 — 레이아웃 + 배경 효과 기반 자동 생성. */
export function deriveSampleLayoutLabel(c: DesignConfig): string {
  const layoutName = sampleLayoutName(c.main.layout);
  const petalName = SAMPLE_PETAL_TAG[c.petalType] ?? PETAL_LABELS[c.petalType] ?? '';
  return petalName ? `${layoutName} · ${petalName}` : layoutName;
}

// ─────────────────────────────────────────────────────────────
// 4. 코드 기본 디자인 12종 (시드)
// ─────────────────────────────────────────────────────────────

interface Seed {
  id: string;
  name: string;
  layoutLabel: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  layout: InvitationContent['main']['layout'];
  heroImageId: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  greetingShort: string;
}

const SEEDS: Seed[] = [
  { id: 'cream-poster', name: '크림 포스터', layoutLabel: '풀이미지 · 벚꽃', colorTheme: 'cream', petalType: 'sakura', font: 'gowun', layout: 'poster', heroImageId: 'studio-floral-pastel', groomName: '민준', brideName: '서연', weddingDate: '2026-05-23', greetingShort: '저희 두 사람, 결혼합니다' },
  { id: 'blush-frame', name: '블러쉬 프레임', layoutLabel: '액자 · 꽃잎', colorTheme: 'blush', petalType: 'flower', font: 'songMyung', layout: 'frame', heroImageId: 'studio-ivory-satin-couple', groomName: '도윤', brideName: '지우', weddingDate: '2026-06-13', greetingShort: '봄날의 약속' },
  { id: 'forest-illust', name: '포레스트 보태니컬', layoutLabel: '일러스트 · 잎', colorTheme: 'forest', petalType: 'leaf', font: 'jeju', layout: 'illustration', heroImageId: 'garden-finger-heart', groomName: '우진', brideName: '서윤', weddingDate: '2026-09-19', greetingShort: '초록 가득한 날에' },
  { id: 'midnight-cinematic', name: '미드나잇 시네마틱', layoutLabel: '풀이미지 · 별빛', colorTheme: 'midnight', petalType: 'starlight', font: 'pretendard', layout: 'poster', heroImageId: 'seoul-nightview', groomName: '시우', brideName: '예린', weddingDate: '2026-10-24', greetingShort: '별이 빛나는 밤에' },
  { id: 'navy-classic', name: '네이비 클래식', layoutLabel: '풀이미지 · 별', colorTheme: 'navy', petalType: 'star', font: 'gmarket', layout: 'poster', heroImageId: 'studio-couple-blackwhite', groomName: '준호', brideName: '다은', weddingDate: '2026-11-07', greetingShort: '변치 않을 약속' },
  { id: 'letter-minimal', name: '편지지 미니멀', layoutLabel: '텍스트 · 무효과', colorTheme: 'letterPaper', petalType: 'none', font: 'songMyung', layout: 'text', heroImageId: 'studio-arch-window-couple', groomName: '현우', brideName: '소율', weddingDate: '2026-04-11', greetingShort: 'We are getting married' },
  { id: 'lavender-starlight', name: '라벤더 오로라', layoutLabel: '액자 · 별빛', colorTheme: 'lavender', petalType: 'starlight', font: 'gowun', layout: 'frame', heroImageId: 'city-goldenhour-balcony', groomName: '지호', brideName: '유나', weddingDate: '2026-08-29', greetingShort: '함께 물든 노을' },
  { id: 'champagne-gold', name: '샴페인 골드', layoutLabel: '풀이미지 · 보케', colorTheme: 'champagne', petalType: 'bokeh', font: 'songMyung', layout: 'poster', heroImageId: 'canola-field-walk', groomName: '건우', brideName: '채원', weddingDate: '2026-05-09', greetingShort: '햇살 가득한 날' },
  { id: 'rose-romantic', name: '더스티 로즈', layoutLabel: '액자 · 흰 꽃잎', colorTheme: 'rose', petalType: 'whitePetal', font: 'gowun', layout: 'frame', heroImageId: 'studio-shoulder-lean', groomName: '태경', brideName: '하린', weddingDate: '2026-07-04', greetingShort: '로즈빛 약속' },
  { id: 'sky-poster', name: '스카이 포스터', layoutLabel: '풀이미지 · 하트', colorTheme: 'sky', petalType: 'heart', font: 'gowun', layout: 'poster', heroImageId: 'meadow-blue-sky-couple', groomName: '하준', brideName: '아윤', weddingDate: '2026-04-25', greetingShort: '맑은 봄날에' },
  { id: 'pearl-minimal', name: '펄 미니멀', layoutLabel: '텍스트 · 무효과', colorTheme: 'pearl', petalType: 'none', font: 'songMyung', layout: 'text', heroImageId: 'beige-wall-cheek-lean', groomName: '윤서', brideName: '서아', weddingDate: '2026-03-14', greetingShort: 'Save the date' },
  { id: 'charcoal-modern', name: '차콜 모던', layoutLabel: '일러스트 · 잎', colorTheme: 'charcoal', petalType: 'leaf', font: 'pretendard', layout: 'illustration', heroImageId: 'studio-greenwall-glasses', groomName: '도현', brideName: '예지', weddingDate: '2026-12-05', greetingShort: '모던한 시작' },
];

function seedToConfig(s: Seed): DesignConfig {
  const main = defaultInvitationContent().main;
  main.layout = s.layout;
  main.greeting = s.greetingShort;
  main.heroImage = null;
  return {
    id: s.id,
    enabled: true,
    name: s.name,
    layoutLabel: s.layoutLabel,
    groomName: s.groomName,
    brideName: s.brideName,
    weddingDate: s.weddingDate,
    colorTheme: s.colorTheme,
    petalType: s.petalType,
    font: s.font,
    heroImageId: s.heroImageId,
    main,
  };
}

export const DEFAULT_SAMPLE_CONFIGS: DesignConfig[] = SEEDS.map(seedToConfig);

export const DEFAULT_AI_SNAP_IDS: string[] = [
  'hanbok-couple-studio',
  'studio-couple-blackwhite',
  'garden-champagne-toast',
  'countryside-bicycle-sunset',
  'studio-floral-pastel',
  'beach-classic-white',
  'seoul-nightview',
  'paris-eiffel-walk',
  'jeju-rocky-coast',
  'cinema-redseat-couple',
  'vintage-90s-street-vsign',
  'yacht-sunset-hug',
  'city-goldenhour-balcony',
];

export const DEFAULT_HOME_SAMPLES_CONFIG: HomeSamplesConfig = {
  aiSnapCatalogIds: DEFAULT_AI_SNAP_IDS,
  designs: DEFAULT_SAMPLE_CONFIGS,
  beforeAfter: DEFAULT_BEFORE_AFTER,
  template: DEFAULT_TEMPLATE,
};

export const SAMPLE_DESIGNS: SampleDesign[] = DEFAULT_SAMPLE_CONFIGS.map((c) =>
  buildDesign(c, DEFAULT_TEMPLATE),
);

/** 표지(메인 슬라이드)만 렌더하도록 pageOrder 를 main 한 장으로 줄인 콘텐츠. */
export function coverContent(content: InvitationContent): InvitationContent {
  return { ...content, theme: { ...content.theme, pageOrder: ['main'] } };
}
