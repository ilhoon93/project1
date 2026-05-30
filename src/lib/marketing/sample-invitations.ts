import {
  defaultInvitationContent,
  type InvitationContent,
} from '@/types/invitation';
import type { ColorTheme, PetalType, FontKey } from '@/lib/theme';

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
  label: string;
  afterLabel: string;
  /** Catalog 또는 mode-examples 의 전체 경로. */
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
  voteQuestion: string;
  voteOptions: string[]; // length 2
  guestbookMessage: string;
  accountGuide: string;
  accountGroomBank: string;
  accountGroomNumber: string;
  accountBrideBank: string;
  accountBrideNumber: string;
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
    'cinema-popcorn-couple',
    'yacht-sunset-hug',
    'countryside-bicycle-sunset',
  ],
  quizQuestion: '두 사람이 처음 만난 곳은?',
  quizOptions: ['대학교 동아리', '회사 워크샵', '소개팅 앱', '친구 소개'],
  quizAnswer: 0,
  voteQuestion: '신혼여행은 어디로 가면 좋을까요?',
  voteOptions: ['발리', '제주'],
  guestbookMessage: '축하 한마디와 서명을 남겨주세요!',
  accountGuide: '축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다.',
  accountGroomBank: '우리은행',
  accountGroomNumber: '1002-000-000000',
  accountBrideBank: '국민은행',
  accountBrideNumber: '123-00-000000',
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

  content.quiz = {
    enabled: true,
    questions: [
      {
        q: t.quizQuestion,
        options: [t.quizOptions[0] ?? '', t.quizOptions[1] ?? '', t.quizOptions[2] ?? '', t.quizOptions[3] ?? ''],
        answer: Math.max(0, Math.min(3, t.quizAnswer)),
      },
    ],
  };

  content.vote = {
    enabled: true,
    questions: [
      { q: t.voteQuestion, options: [t.voteOptions[0] ?? '', t.voteOptions[1] ?? ''] },
    ],
  };

  content.guestbook = { enabled: true, coupleMessage: t.guestbookMessage };

  content.account.guide = t.accountGuide;
  content.account.groom = [
    { bank: t.accountGroomBank, number: t.accountGroomNumber, holder: c.groomName },
  ];
  content.account.bride = [
    { bank: t.accountBrideBank, number: t.accountBrideNumber, holder: c.brideName },
  ];

  content.closing = t.closing;

  return {
    id: c.id,
    name: c.name,
    layoutLabel: c.layoutLabel,
    groomName: c.groomName,
    brideName: c.brideName,
    weddingDate: c.weddingDate,
    content,
  };
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
  'cinema-popcorn-couple',
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
