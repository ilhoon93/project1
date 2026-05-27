import {
  defaultInvitationContent,
  type InvitationContent,
} from '@/types/invitation';
import type { ColorTheme, PetalType, FontKey } from '@/lib/theme';

/**
 * 마케팅용 알림장 디자인 샘플 — 히어로 폰, 알림장 소개 섹션, /designs 카탈로그가
 * 공유하는 단일 소스. 운영자(/admin/home-samples)가 표지·테마를 덮어쓸 수 있도록
 * "설정(DesignConfig)" → "렌더 가능한 SampleDesign" 으로 분리했다.
 *
 * 실제 발행 알림장과 동일한 렌더러(InvitationSlides)를 그대로 쓰기 위해 진짜
 * InvitationContent 객체를 만든다. 이미지 필드는 스키마상 z.string().url() 이라
 * 상대경로(/public)가 .parse 를 통과하지 못하므로, defaultInvitationContent() 로
 * 기본값을 만든 뒤 필요한 필드만 직접 대입한다(재파싱하지 않음).
 *
 * 본문(스토리/갤러리/퀴즈/투표/계좌)은 9개 샘플이 공유하는 템플릿이고, 운영자가
 * 바꾸는 건 "표지 레벨"(테마·효과·폰트·레이아웃·표지사진·이름·인사말)뿐이다.
 */

export interface SampleDesign {
  id: string;
  name: string;
  layoutLabel: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  content: InvitationContent;
}

/** 운영자가 편집 가능한 "표지 레벨" 설정 — DB(marketing_home_samples.designs)에 저장. */
export interface DesignConfig {
  id: string;
  enabled: boolean;
  name: string;
  layoutLabel: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  layout: InvitationContent['main']['layout'];
  /** 카탈로그 id — 표지 배경 사진. `/wedding-snap/catalog/{id}.jpg` */
  heroImageId: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  greetingShort: string;
}

/** 메인 AI스냅(폴라로이드+스트립) 한 칸 — 카탈로그 id 를 라벨/경로로 풀어둔 형태. */
export interface AiSnapItem {
  id: string;
  label: string;
  src: string;
}

/** marketing_home_samples 한 행에 대응하는 설정. */
export interface HomeSamplesConfig {
  aiSnapCatalogIds: string[];
  designs: DesignConfig[];
}

const CAT = '/wedding-snap/catalog';

// 스토리·갤러리 사진은 9개 샘플이 공유 (디자인 차이를 테마/레이아웃/표지로 보여줌).
const STORY_IMAGES = [
  `${CAT}/studio-couple-puppy.jpg`,
  `${CAT}/garden-champagne-toast.jpg`,
  `${CAT}/jeju-stonewall-cheer.jpg`,
];
const GALLERY_IMAGES = [
  `${CAT}/beach-classic-white.jpg`,
  `${CAT}/paris-eiffel-walk.jpg`,
  `${CAT}/hanbok-couple-studio.jpg`,
  `${CAT}/cinema-popcorn-couple.jpg`,
  `${CAT}/yacht-sunset-hug.jpg`,
  `${CAT}/countryside-bicycle-sunset.jpg`,
];

/** DesignConfig(표지 설정) + 공유 본문 → 실제 렌더 가능한 SampleDesign. */
export function buildDesign(c: DesignConfig): SampleDesign {
  const content = defaultInvitationContent();

  content.theme.colorTheme = c.colorTheme;
  content.theme.petalType = c.petalType;
  content.theme.font = c.font;

  content.main.layout = c.layout;
  content.main.heroImage = `${CAT}/${c.heroImageId}.jpg`;
  content.main.greeting = c.greetingShort;

  content.basic.greeting = {
    enabled: true,
    text: '서로의 가장 가까운 친구가 되기로 했습니다.\n저희 두 사람의 새로운 시작을 함께 축복해 주세요.',
  };
  content.basic.quote = { enabled: true, text: '사랑은 함께 같은 곳을 바라보는 것.' };
  content.basic.family = {
    enabled: true,
    groomFather: { name: '김상현', deceased: false },
    groomMother: { name: '이정희', deceased: false },
    brideFather: { name: '박준호', deceased: false },
    brideMother: { name: '최은영', deceased: false },
  };

  content.story.chapters = [
    {
      title: '첫 만남',
      text: '우연히 같은 자리에 앉았던 그날, 서로를 알아본 순간부터 모든 게 시작됐어요.',
      image: STORY_IMAGES[0],
    },
    {
      title: '서로에게 물들다',
      text: '평범한 하루도 함께라 특별해졌습니다. 사계절을 나란히 걸으며 닮아갔어요.',
      image: STORY_IMAGES[1],
    },
    {
      title: '프로포즈',
      text: '오래 함께하고 싶다는 마음을 담아, 평생의 약속을 건넸습니다.',
      image: STORY_IMAGES[2],
    },
  ];

  content.gallery = { enabled: true, layout: 'grid', images: GALLERY_IMAGES };

  content.quiz = {
    enabled: true,
    questions: [
      {
        q: '두 사람이 처음 만난 곳은?',
        options: ['대학교 동아리', '회사 워크샵', '소개팅 앱', '친구 소개'],
        answer: 0,
      },
    ],
  };

  content.vote = {
    enabled: true,
    questions: [{ q: '신혼여행은 어디로 가면 좋을까요?', options: ['발리', '제주'] }],
  };

  content.guestbook = { enabled: true, coupleMessage: '축하 한마디와 서명을 남겨주세요!' };

  content.account.groom = [
    { bank: '우리은행', number: '1002-000-000000', holder: c.groomName },
  ];
  content.account.bride = [
    { bank: '국민은행', number: '123-00-000000', holder: c.brideName },
  ];

  content.closing = '와주셔서 진심으로 감사합니다';

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

/** 코드 기본 디자인 9종 — 운영자 설정이 없을 때 폴백. */
export const DEFAULT_SAMPLE_CONFIGS: DesignConfig[] = [
  {
    id: 'cream-poster',
    enabled: true,
    name: '크림 포스터',
    layoutLabel: '풀이미지 · 벚꽃',
    colorTheme: 'cream',
    petalType: 'sakura',
    font: 'gowun',
    layout: 'poster',
    heroImageId: 'studio-floral-pastel',
    groomName: '민준',
    brideName: '서연',
    weddingDate: '2026-05-23',
    greetingShort: '저희 두 사람, 결혼합니다',
  },
  {
    id: 'blush-frame',
    enabled: true,
    name: '블러쉬 프레임',
    layoutLabel: '액자 · 꽃잎',
    colorTheme: 'blush',
    petalType: 'flower',
    font: 'songMyung',
    layout: 'frame',
    heroImageId: 'studio-ivory-satin-couple',
    groomName: '도윤',
    brideName: '지우',
    weddingDate: '2026-06-13',
    greetingShort: '봄날의 약속',
  },
  {
    id: 'forest-illust',
    enabled: true,
    name: '포레스트 보태니컬',
    layoutLabel: '일러스트 · 잎',
    colorTheme: 'forest',
    petalType: 'leaf',
    font: 'jeju',
    layout: 'illustration',
    heroImageId: 'garden-finger-heart',
    groomName: '우진',
    brideName: '서윤',
    weddingDate: '2026-09-19',
    greetingShort: '초록 가득한 날에',
  },
  {
    id: 'midnight-cinematic',
    enabled: true,
    name: '미드나잇 시네마틱',
    layoutLabel: '풀이미지 · 별빛',
    colorTheme: 'midnight',
    petalType: 'starlight',
    font: 'pretendard',
    layout: 'poster',
    heroImageId: 'seoul-nightview',
    groomName: '시우',
    brideName: '예린',
    weddingDate: '2026-10-24',
    greetingShort: '별이 빛나는 밤에',
  },
  {
    id: 'navy-classic',
    enabled: true,
    name: '네이비 클래식',
    layoutLabel: '풀이미지 · 별',
    colorTheme: 'navy',
    petalType: 'star',
    font: 'gmarket',
    layout: 'poster',
    heroImageId: 'studio-couple-blackwhite',
    groomName: '준호',
    brideName: '다은',
    weddingDate: '2026-11-07',
    greetingShort: '변치 않을 약속',
  },
  {
    id: 'letter-minimal',
    enabled: true,
    name: '편지지 미니멀',
    layoutLabel: '텍스트 · 무효과',
    colorTheme: 'letterPaper',
    petalType: 'none',
    font: 'songMyung',
    layout: 'text',
    heroImageId: 'studio-arch-window-couple',
    groomName: '현우',
    brideName: '소율',
    weddingDate: '2026-04-11',
    greetingShort: 'We are getting married',
  },
  {
    id: 'lavender-starlight',
    enabled: true,
    name: '라벤더 오로라',
    layoutLabel: '액자 · 별빛',
    colorTheme: 'lavender',
    petalType: 'starlight',
    font: 'gowun',
    layout: 'frame',
    heroImageId: 'city-goldenhour-balcony',
    groomName: '지호',
    brideName: '유나',
    weddingDate: '2026-08-29',
    greetingShort: '함께 물든 노을',
  },
  {
    id: 'champagne-gold',
    enabled: true,
    name: '샴페인 골드',
    layoutLabel: '풀이미지 · 보케',
    colorTheme: 'champagne',
    petalType: 'bokeh',
    font: 'songMyung',
    layout: 'poster',
    heroImageId: 'canola-field-walk',
    groomName: '건우',
    brideName: '채원',
    weddingDate: '2026-05-09',
    greetingShort: '햇살 가득한 날',
  },
  {
    id: 'rose-romantic',
    enabled: true,
    name: '더스티 로즈',
    layoutLabel: '액자 · 흰 꽃잎',
    colorTheme: 'rose',
    petalType: 'whitePetal',
    font: 'gowun',
    layout: 'frame',
    heroImageId: 'studio-shoulder-lean',
    groomName: '태경',
    brideName: '하린',
    weddingDate: '2026-07-04',
    greetingShort: '로즈빛 약속',
  },
];

/** 메인 AI스냅 기본 카탈로그 id — 앞 4개=폴라로이드, 전체=썸네일 스트립. */
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

/** 기본 설정 (운영자 미설정 시). */
export const DEFAULT_HOME_SAMPLES_CONFIG: HomeSamplesConfig = {
  aiSnapCatalogIds: DEFAULT_AI_SNAP_IDS,
  designs: DEFAULT_SAMPLE_CONFIGS,
};

/** 코드 기본 디자인 9종을 렌더 가능한 형태로. (props 미전달 컴포넌트의 폴백) */
export const SAMPLE_DESIGNS: SampleDesign[] = DEFAULT_SAMPLE_CONFIGS.map(buildDesign);

/** 표지(메인 슬라이드)만 렌더하도록 pageOrder 를 main 한 장으로 줄인 콘텐츠. */
export function coverContent(content: InvitationContent): InvitationContent {
  return { ...content, theme: { ...content.theme, pageOrder: ['main'] } };
}
