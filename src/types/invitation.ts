import { z } from 'zod';
import {
  COLOR_THEMES,
  FONT_KEYS,
  PETAL_TYPES,
  SECTION_KEYS,
  TITLE_FONT_KEYS,
  TITLE_TEXT_PRESETS,
} from '@/lib/theme';

// ── theme (global look & feel + page ordering) ────────────

export const BgmSchema = z
  .object({
    enabled: z.boolean().default(false),
    url: z.string().url().nullable().default(null),
  })
  .default({ enabled: false, url: null });

export const ThemeSchema = z
  .object({
    colorTheme: z.enum(COLOR_THEMES).default('cream'),
    petalType: z.enum(PETAL_TYPES).default('flower'),
    font: z.enum(FONT_KEYS).default('serif'),
    // Stored as plain strings so adding new section keys later doesn't break
    // existing data; reconcilePageOrder() in lib/theme.ts normalizes at render time.
    pageOrder: z.array(z.string()).default([...SECTION_KEYS]),
    bgm: BgmSchema,
  })
  .default({
    colorTheme: 'cream',
    petalType: 'flower',
    font: 'serif',
    pageOrder: [...SECTION_KEYS],
    bgm: { enabled: false, url: null },
  });

// ── individual section schemas ────────────────────────────

export const MAIN_LAYOUTS = [
  'poster',
  // 액자프레임 — 일러스트형과 같은 패턴: 단일 레이아웃 키 아래에 variant
  // (폴라로이드 / 하트 / 스크린) 를 가진다. 변형은 FrameDesignSchema.variant 로
  // 선택. 이전에 사용하던 'polaroid' 키는 frame 으로 흡수되었지만, 기존
  // 데이터에 있을 수 있어 호환을 위해 enum 에 남겨둔다 (내부적으로는
  // layout==='frame' 와 동일하게 처리).
  'frame',
  'polaroid',
  'illustration',
  'text',
] as const;

// 'polaroid' 같은 구버전 layout 키는 FrameDesign 분기로 같이 보냄.
export const FRAME_LAYOUT_KEYS = ['frame', 'polaroid'] as const;

// 풀이미지형(=poster) 디자인 구성. 다른 레이아웃에서는 무시되지만
// 사용자가 레이아웃을 다시 poster 로 바꿨을 때 직전 설정이 보존되도록
// MainSectionSchema 상에서는 항상 보관한다.

const PositionSchema = z
  .object({
    x: z.number().min(0).max(100).default(50),
    y: z.number().min(0).max(100).default(50),
  })
  .default({ x: 50, y: 50 });

// 이미지 표시 방식.
//   - cover  : 프레임을 가득 채우고 imagePosition 으로 보일 영역을 선택 (기존 동작).
//   - contain: 이미지 전체를 잘리지 않게 보여주고 남는 영역은 배경색으로 채움.
export const POSTER_IMAGE_FITS = ['cover', 'contain'] as const;
export type PosterImageFit = (typeof POSTER_IMAGE_FITS)[number];

export const PosterDesignSchema = z
  .object({
    effects: z
      .object({
        gradient: z.boolean().default(true),
        border: z.boolean().default(false),
      })
      .default({ gradient: true, border: false }),
    image: z
      .object({
        fit: z.enum(POSTER_IMAGE_FITS).default('cover'),
        // cover 일 때 보일 영역의 중심점(0–100 %). object-position 으로 매핑.
        position: PositionSchema.default({ x: 50, y: 50 }),
      })
      .default({ fit: 'cover', position: { x: 50, y: 50 } }),
    title: z
      .object({
        // 콤보박스 프리셋(TITLE_TEXT_PRESETS) 또는 직접 입력 — 자유 문자열.
        text: z.string().max(60).default(TITLE_TEXT_PRESETS[0]),
        font: z.enum(TITLE_FONT_KEYS).default('playfairDisplay'),
        // CSS 색상 문자열(hex / rgb / 명명색). 기본은 흰색 — 풀이미지 위.
        color: z.string().max(32).default('#FFFFFF'),
        animate: z.boolean().default(true),
        position: PositionSchema.default({ x: 50, y: 12 }),
        // px 단위 — 슬라이더로 24–72 사이에서 조정.
        fontSize: z.number().min(24).max(72).default(40),
      })
      .default({
        text: TITLE_TEXT_PRESETS[0],
        font: 'playfairDisplay',
        color: '#FFFFFF',
        animate: true,
        position: { x: 50, y: 12 },
        fontSize: 40,
      }),
    dateBox: z
      .object({
        enabled: z.boolean().default(true),
        position: PositionSchema.default({ x: 50, y: 88 }),
        fontSize: z.number().min(12).max(40).default(14),
      })
      .default({ enabled: true, position: { x: 50, y: 88 }, fontSize: 14 }),
    nameBox: z
      .object({
        enabled: z.boolean().default(true),
        position: PositionSchema.default({ x: 50, y: 72 }),
        fontSize: z.number().min(12).max(40).default(22),
      })
      .default({ enabled: true, position: { x: 50, y: 72 }, fontSize: 22 }),
    messageBox: z
      .object({
        enabled: z.boolean().default(true),
        position: PositionSchema.default({ x: 50, y: 80 }),
        fontSize: z.number().min(12).max(40).default(14),
      })
      .default({ enabled: true, position: { x: 50, y: 80 }, fontSize: 14 }),
  })
  .default({
    effects: { gradient: true, border: false },
    image: { fit: 'cover', position: { x: 50, y: 50 } },
    title: {
      text: TITLE_TEXT_PRESETS[0],
      font: 'playfairDisplay',
      color: '#FFFFFF',
      animate: true,
      position: { x: 50, y: 12 },
      fontSize: 40,
    },
    dateBox: { enabled: true, position: { x: 50, y: 88 }, fontSize: 14 },
    nameBox: { enabled: true, position: { x: 50, y: 72 }, fontSize: 22 },
    messageBox: { enabled: true, position: { x: 50, y: 80 }, fontSize: 14 },
  });

export type PosterDesign = z.infer<typeof PosterDesignSchema>;

// ── 일러스트형 디자인 ─────────────────────────────────────
//
// 일러스트형은 두 가지 서브 베리언트(arch / dance)를 제공한다.
//   - arch  : 꽃 아치 아래 손 잡고 걷는 신랑·신부
//   - dance : 댄스 포즈의 신랑·신부 + 골드 스파클
//
// 폰트는 첨부 이미지(Playfair Display)에 맞춰 고정. 색상과 문구만
// 풀이미지형처럼 사용자가 변경 가능. 날짜·이름 박스는 토글 가능하지만
// 위치는 고정 레이아웃을 따른다 (드래그 슬라이더 없음).

export const ILLUSTRATION_VARIANTS = ['arch', 'dance'] as const;
export type IllustrationVariant = (typeof ILLUSTRATION_VARIANTS)[number];

export const IllustrationDesignSchema = z
  .object({
    variant: z.enum(ILLUSTRATION_VARIANTS).default('arch'),
    title: z
      .object({
        text: z.string().max(60).default(TITLE_TEXT_PRESETS[4]), // "A day, our way"
        // 색상은 hex / 'currentColor' 둘 다 받는다. 'currentColor' 면 테마 fg.
        color: z.string().max(32).default('currentColor'),
        // px 단위 — 슬라이더로 22–48 사이에서 조정.
        fontSize: z.number().min(22).max(48).default(34),
        // 기본 위치(이미지 상단 위쪽)를 기준으로 cqh 단위 상하 미세 조정.
        // 음수 = 위로, 양수 = 아래로. -10 ~ +10 cqh.
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({
        text: TITLE_TEXT_PRESETS[4],
        color: 'currentColor',
        fontSize: 34,
        offsetY: 0,
      }),
    dateBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(11).max(22).default(15),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 15, offsetY: 0 }),
    nameBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(12).max(24).default(16),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 16, offsetY: 0 }),
    // 인사말 — main.greeting 본문을 표시할지/얼마만큼 보여줄지 결정.
    messageBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(11).max(20).default(13),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 13, offsetY: 0 }),
  })
  .default({
    variant: 'arch',
    title: { text: TITLE_TEXT_PRESETS[4], color: 'currentColor', fontSize: 34, offsetY: 0 },
    dateBox: { enabled: true, fontSize: 15, offsetY: 0 },
    nameBox: { enabled: true, fontSize: 16, offsetY: 0 },
    messageBox: { enabled: true, fontSize: 13, offsetY: 0 },
  });

export type IllustrationDesign = z.infer<typeof IllustrationDesignSchema>;

// ── 액자프레임 디자인 ────────────────────────────────────
//
// 폴라로이드 / 하트 / 스크린 세 변형이 같은 스키마를 공유한다 — 각 변형의 차이는
// 이미지 프레임 모양이고, 그 외 제목·이름·날짜·인사말 요소는 동일한 컨트롤로
// 노출한다. 일러스트형과 동일한 패턴으로 variant 필드 하나로 변형을 선택한다.

export const FRAME_VARIANTS = ['polaroid', 'heart', 'screen'] as const;
export type FrameVariant = (typeof FRAME_VARIANTS)[number];

export const FrameDesignSchema = z
  .object({
    variant: z.enum(FRAME_VARIANTS).default('polaroid'),
    // 사진 어느 부분을 프레임에 보일지 — object-position 으로 매핑 (0–100 %).
    // screen 변형(정사각형 + contain) 처럼 잘리지 않는 케이스에서는 의미 없음.
    imagePosition: PositionSchema.default({ x: 50, y: 50 }),
    title: z
      .object({
        enabled: z.boolean().default(true),
        text: z.string().max(60).default(TITLE_TEXT_PRESETS[0]),
        font: z.enum(TITLE_FONT_KEYS).default('playfairDisplay'),
        color: z.string().max(32).default('currentColor'),
        fontSize: z.number().min(18).max(44).default(26),
        // 기본 위치 대비 cqh 단위 상하 미세 조정. 음수 = 위로, 양수 = 아래로.
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({
        enabled: true,
        text: TITLE_TEXT_PRESETS[0],
        font: 'playfairDisplay',
        color: 'currentColor',
        fontSize: 26,
        offsetY: 0,
      }),
    nameBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(12).max(28).default(20),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 20, offsetY: 0 }),
    dateBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(11).max(22).default(14),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 14, offsetY: 0 }),
    messageBox: z
      .object({
        enabled: z.boolean().default(true),
        fontSize: z.number().min(11).max(22).default(13),
        offsetY: z.number().min(-10).max(10).default(0),
      })
      .default({ enabled: true, fontSize: 13, offsetY: 0 }),
  })
  .default({
    variant: 'polaroid',
    imagePosition: { x: 50, y: 50 },
    title: {
      enabled: true,
      text: TITLE_TEXT_PRESETS[0],
      font: 'playfairDisplay',
      color: 'currentColor',
      fontSize: 26,
      offsetY: 0,
    },
    nameBox: { enabled: true, fontSize: 20, offsetY: 0 },
    dateBox: { enabled: true, fontSize: 14, offsetY: 0 },
    messageBox: { enabled: true, fontSize: 13, offsetY: 0 },
  });

export type FrameDesign = z.infer<typeof FrameDesignSchema>;

// 짧은 간 PR 에서만 살아 있던 구버전 layout 키('frameHeart' / 'frameScreen') 가
// 저장된 데이터에 남아 있으면 z.enum 검증이 실패한다. 두 키를 신규 키('frame')
// + frameDesign.variant 로 매핑해주는 preprocess 단계로 안전하게 마이그레이션.
function migrateMainSection(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const obj = input as Record<string, unknown>;
  if (obj.layout === 'frameHeart' || obj.layout === 'frameScreen') {
    const variant = obj.layout === 'frameHeart' ? 'heart' : 'screen';
    const existingFrame =
      obj.frameDesign && typeof obj.frameDesign === 'object'
        ? (obj.frameDesign as Record<string, unknown>)
        : {};
    return {
      ...obj,
      layout: 'frame',
      frameDesign: { ...existingFrame, variant },
    };
  }
  return obj;
}

export const MainSectionSchema = z.preprocess(
  migrateMainSection,
  z
    .object({
      layout: z.enum(MAIN_LAYOUTS).default('poster'),
      heroImage: z.string().url().nullable().optional(),
      greeting: z.string().max(500).default(''),
      /** Free AI generation is one-shot; flips true after a successful run. */
      aiUsed: z.boolean().default(false),
      posterDesign: PosterDesignSchema,
      illustrationDesign: IllustrationDesignSchema,
      frameDesign: FrameDesignSchema,
    })
    .default({
      layout: 'poster',
      greeting: '',
      aiUsed: false,
      posterDesign: PosterDesignSchema.parse(undefined),
      illustrationDesign: IllustrationDesignSchema.parse(undefined),
      frameDesign: FrameDesignSchema.parse(undefined),
    }),
);

// ── basic info slide (글귀 / 인사말 / 가족 / 날짜) ──────────

export const ParentSchema = z.object({
  name: z.string().max(20).default(''),
  deceased: z.boolean().default(false),
});

// 기본정보 슬라이드의 4가지 하위 영역 — 사용자가 순서를 바꿀 수 있게 했다.
// 저장값에 알 수 없는 키가 들어 있거나 일부 키가 빠져 있어도 reconcileBasicSubOrder
// 에서 안전하게 보정한다.
export const BASIC_SUB_KEYS = ['family', 'date', 'greeting', 'quote'] as const;
export type BasicSubKey = (typeof BASIC_SUB_KEYS)[number];

export const BasicInfoSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    quote: z
      .object({
        enabled: z.boolean().default(false),
        text: z.string().max(200).default(''),
      })
      .default({ enabled: false, text: '' }),
    greeting: z
      .object({
        enabled: z.boolean().default(true),
        text: z.string().max(500).default(''),
      })
      .default({ enabled: true, text: '' }),
    family: z
      .object({
        enabled: z.boolean().default(true),
        groomFather: ParentSchema,
        groomMother: ParentSchema,
        brideFather: ParentSchema,
        brideMother: ParentSchema,
      })
      .default({
        enabled: true,
        groomFather: { name: '', deceased: false },
        groomMother: { name: '', deceased: false },
        brideFather: { name: '', deceased: false },
        brideMother: { name: '', deceased: false },
      }),
    showDate: z.boolean().default(true),
    // 하위 영역 표시 순서. 저장 시 일부가 빠져도 reconcileBasicSubOrder 가 채워줌.
    subOrder: z.array(z.string()).default([...BASIC_SUB_KEYS]),
  })
  .default({
    enabled: true,
    quote: { enabled: false, text: '' },
    greeting: { enabled: true, text: '' },
    family: {
      enabled: true,
      groomFather: { name: '', deceased: false },
      groomMother: { name: '', deceased: false },
      brideFather: { name: '', deceased: false },
      brideMother: { name: '', deceased: false },
    },
    showDate: true,
    subOrder: [...BASIC_SUB_KEYS],
  });

/**
 * 저장된 subOrder 를 정규화 — 알 수 없는 키 제거 + 빠진 키를 끝에 보충.
 * (theme 의 reconcilePageOrder 와 동일한 패턴.)
 */
export function reconcileBasicSubOrder(stored: readonly string[]): BasicSubKey[] {
  const known = new Set<string>(BASIC_SUB_KEYS);
  const seen = new Set<string>();
  const ordered: BasicSubKey[] = [];
  for (const key of stored) {
    if (known.has(key) && !seen.has(key)) {
      ordered.push(key as BasicSubKey);
      seen.add(key);
    }
  }
  for (const key of BASIC_SUB_KEYS) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}

export const StoryChapterSchema = z.object({
  // Free-form title — guidance text shown via placeholder ("첫 만남", "고백", "프로포즈" 등).
  title: z.string().max(40).default(''),
  image: z.string().url().nullable().optional(),
  text: z.string().max(500).default(''),
});

export const StorySectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    chapters: z.array(StoryChapterSchema).max(8).default([]),
  })
  .default({
    enabled: true,
    chapters: [
      { title: '첫 만남', text: '' },
      { title: '고백', text: '' },
      { title: '프로포즈', text: '' },
    ],
  });

export const GALLERY_LAYOUTS = ['slide', 'grid'] as const;

export const GallerySectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    layout: z.enum(GALLERY_LAYOUTS).default('grid'),
    images: z.array(z.string().url()).max(20).default([]),
  })
  .default({ enabled: true, layout: 'grid', images: [] });

export const VideoSectionSchema = z
  .object({
    enabled: z.boolean().default(false),
    title: z.string().max(50).default(''),
    url: z.string().url().nullable().default(null),
  })
  .default({ enabled: false, title: '', url: null });

// Drafts may have empty strings while the user is still typing; render-time
// guards in QuizSlide skip questions whose required fields are blank.
export const QuizQuestionSchema = z.object({
  q: z.string().max(100).default(''),
  options: z.array(z.string().max(50).default('')).length(4),
  answer: z.number().int().min(0).max(3),
});

export const QuizSectionSchema = z
  .object({
    enabled: z.boolean().default(false),
    questions: z.array(QuizQuestionSchema).max(2).default([]),
  })
  .default({ enabled: false, questions: [] });

export const VoteQuestionSchema = z.object({
  q: z.string().max(100).default(''),
  options: z.array(z.string().max(50).default('')).length(2),
});

export const VoteSectionSchema = z
  .object({
    enabled: z.boolean().default(false),
    questions: z.array(VoteQuestionSchema).max(2).default([]),
  })
  .default({ enabled: false, questions: [] });

export const GuestbookSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    coupleMessage: z.string().max(300).default(''),
  })
  .default({ enabled: true, coupleMessage: '' });

// Allow drafts (empty fields) the same way Quiz/Vote do; render-time guards
// in AccountSlide skip incomplete entries.
export const BankAccountSchema = z.object({
  bank: z.string().max(20).default(''),
  number: z.string().max(30).default(''),
  holder: z.string().max(20).default(''),
});

export const ACCOUNT_PARTY_KEYS = [
  'groom',
  'bride',
  'groomFather',
  'groomMother',
  'brideFather',
  'brideMother',
] as const;
export type AccountPartyKey = (typeof ACCOUNT_PARTY_KEYS)[number];

export const AccountSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    /** Top-of-section guide message shown to guests. */
    guide: z
      .string()
      .max(500)
      .default('축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다.'),
    groom: z.array(BankAccountSchema).max(3).default([]),
    bride: z.array(BankAccountSchema).max(3).default([]),
    groomFather: z.array(BankAccountSchema).max(3).default([]),
    groomMother: z.array(BankAccountSchema).max(3).default([]),
    brideFather: z.array(BankAccountSchema).max(3).default([]),
    brideMother: z.array(BankAccountSchema).max(3).default([]),
  })
  .default({
    enabled: true,
    guide: '축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다.',
    groom: [],
    bride: [],
    groomFather: [],
    groomMother: [],
    brideFather: [],
    brideMother: [],
  });

// ── full invitation content ──────────────────────────────

export const InvitationContentSchema = z.object({
  theme: ThemeSchema,
  main: MainSectionSchema,
  basic: BasicInfoSectionSchema,
  story: StorySectionSchema,
  gallery: GallerySectionSchema,
  video: VideoSectionSchema,
  quiz: QuizSectionSchema,
  vote: VoteSectionSchema,
  guestbook: GuestbookSectionSchema,
  account: AccountSectionSchema,
  closing: z.string().max(300).default('와주셔서 진심으로 감사합니다'),
});

export type InvitationContent = z.infer<typeof InvitationContentSchema>;
export type StoryChapter = z.infer<typeof StoryChapterSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type VoteQuestion = z.infer<typeof VoteQuestionSchema>;
export type BankAccount = z.infer<typeof BankAccountSchema>;

// ── create / publish-time payloads ───────────────────────

export const CreateInvitationSchema = z.object({
  groomName: z.string().max(20).default(''),
  brideName: z.string().max(20).default(''),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format expected')
    .nullable()
    .optional(),
});

// 이름/날짜는 새 알림장 생성 후 편집기 안에서 채워넣는 흐름이라
// 빈 문자열도 허용. 발행 시점 검증은 별도 단계에서.
export const UpdateInvitationSchema = z.object({
  groomName: z.string().max(20).optional(),
  brideName: z.string().max(20).optional(),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  content: InvitationContentSchema.optional(),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;
export type UpdateInvitationInput = z.infer<typeof UpdateInvitationSchema>;

/** Returns a fully populated default content object (all sections, defaults filled). */
export const defaultInvitationContent = (): InvitationContent =>
  InvitationContentSchema.parse({});
