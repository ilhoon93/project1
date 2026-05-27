import {
  defaultInvitationContent,
  type InvitationContent,
} from '@/types/invitation';
import type { ColorTheme, PetalType, FontKey } from '@/lib/theme';

/**
 * 마케팅용 알림장 디자인 샘플 — 히어로 폰, 알림장 소개 섹션, /designs 카탈로그가
 * 공유하는 단일 소스.
 *
 * 실제 발행 알림장과 동일한 렌더러(InvitationSlides)를 그대로 쓰기 위해 진짜
 * InvitationContent 객체를 만든다. 이미지 필드는 스키마상 z.string().url() 이라
 * 상대경로(/public)가 .parse 를 통과하지 못하므로, defaultInvitationContent() 로
 * 기본값을 만든 뒤 필요한 필드만 직접 대입한다(재파싱하지 않음). 렌더러는 값을
 * 재검증하지 않으므로 로컬 이미지 경로가 그대로 사용된다.
 */

export interface SampleDesign {
  id: string;
  /** 카탈로그/카드에 표시할 디자인 이름 */
  name: string;
  /** 레이아웃·효과 한 줄 태그 (예: "포스터 · 별빛") */
  layoutLabel: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  content: InvitationContent;
}

const CAT = '/wedding-snap/catalog';

// 스토리·갤러리 사진은 8개 샘플이 공유 (디자인 차이를 테마/레이아웃/표지로 보여줌).
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

interface SpecInput {
  id: string;
  name: string;
  layoutLabel: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  layout: InvitationContent['main']['layout'];
  heroImage: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  greetingShort: string;
}

function build(s: SpecInput): SampleDesign {
  const content = defaultInvitationContent();

  content.theme.colorTheme = s.colorTheme;
  content.theme.petalType = s.petalType;
  content.theme.font = s.font;

  content.main.layout = s.layout;
  content.main.heroImage = s.heroImage;
  content.main.greeting = s.greetingShort;

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
    { bank: '우리은행', number: '1002-000-000000', holder: s.groomName },
  ];
  content.account.bride = [
    { bank: '국민은행', number: '123-00-000000', holder: s.brideName },
  ];

  content.closing = '와주셔서 진심으로 감사합니다';

  return {
    id: s.id,
    name: s.name,
    layoutLabel: s.layoutLabel,
    groomName: s.groomName,
    brideName: s.brideName,
    weddingDate: s.weddingDate,
    content,
  };
}

export const SAMPLE_DESIGNS: SampleDesign[] = [
  build({
    id: 'cream-poster',
    name: '크림 포스터',
    layoutLabel: '풀이미지 · 벚꽃',
    colorTheme: 'cream',
    petalType: 'sakura',
    font: 'gowun',
    layout: 'poster',
    heroImage: `${CAT}/studio-floral-pastel.jpg`,
    groomName: '민준',
    brideName: '서연',
    weddingDate: '2026-05-23',
    greetingShort: '저희 두 사람, 결혼합니다',
  }),
  build({
    id: 'blush-frame',
    name: '블러쉬 프레임',
    layoutLabel: '액자 · 꽃잎',
    colorTheme: 'blush',
    petalType: 'flower',
    font: 'songMyung',
    layout: 'frame',
    heroImage: `${CAT}/studio-ivory-satin-couple.jpg`,
    groomName: '도윤',
    brideName: '지우',
    weddingDate: '2026-06-13',
    greetingShort: '봄날의 약속',
  }),
  build({
    id: 'forest-illust',
    name: '포레스트 보태니컬',
    layoutLabel: '일러스트 · 잎',
    colorTheme: 'forest',
    petalType: 'leaf',
    font: 'jeju',
    layout: 'illustration',
    heroImage: `${CAT}/garden-finger-heart.jpg`,
    groomName: '우진',
    brideName: '서윤',
    weddingDate: '2026-09-19',
    greetingShort: '초록 가득한 날에',
  }),
  build({
    id: 'midnight-cinematic',
    name: '미드나잇 시네마틱',
    layoutLabel: '풀이미지 · 별빛',
    colorTheme: 'midnight',
    petalType: 'starlight',
    font: 'pretendard',
    layout: 'poster',
    heroImage: `${CAT}/seoul-nightview.jpg`,
    groomName: '시우',
    brideName: '예린',
    weddingDate: '2026-10-24',
    greetingShort: '별이 빛나는 밤에',
  }),
  build({
    id: 'navy-classic',
    name: '네이비 클래식',
    layoutLabel: '풀이미지 · 별',
    colorTheme: 'navy',
    petalType: 'star',
    font: 'gmarket',
    layout: 'poster',
    heroImage: `${CAT}/studio-couple-blackwhite.jpg`,
    groomName: '준호',
    brideName: '다은',
    weddingDate: '2026-11-07',
    greetingShort: '변치 않을 약속',
  }),
  build({
    id: 'letter-minimal',
    name: '편지지 미니멀',
    layoutLabel: '텍스트 · 무효과',
    colorTheme: 'letterPaper',
    petalType: 'none',
    font: 'songMyung',
    layout: 'text',
    heroImage: `${CAT}/studio-arch-window-couple.jpg`,
    groomName: '현우',
    brideName: '소율',
    weddingDate: '2026-04-11',
    greetingShort: 'We are getting married',
  }),
  build({
    id: 'lavender-starlight',
    name: '라벤더 오로라',
    layoutLabel: '액자 · 별빛',
    colorTheme: 'lavender',
    petalType: 'starlight',
    font: 'gowun',
    layout: 'frame',
    heroImage: `${CAT}/city-goldenhour-balcony.jpg`,
    groomName: '지호',
    brideName: '유나',
    weddingDate: '2026-08-29',
    greetingShort: '함께 물든 노을',
  }),
  build({
    id: 'champagne-gold',
    name: '샴페인 골드',
    layoutLabel: '풀이미지 · 보케',
    colorTheme: 'champagne',
    petalType: 'bokeh',
    font: 'songMyung',
    layout: 'poster',
    heroImage: `${CAT}/canola-field-walk.jpg`,
    groomName: '건우',
    brideName: '채원',
    weddingDate: '2026-05-09',
    greetingShort: '햇살 가득한 날',
  }),
];

/** 표지(메인 슬라이드)만 렌더하도록 pageOrder 를 main 한 장으로 줄인 콘텐츠. */
export function coverContent(content: InvitationContent): InvitationContent {
  return { ...content, theme: { ...content.theme, pageOrder: ['main'] } };
}
