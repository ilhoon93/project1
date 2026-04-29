import { z } from 'zod';
import { COLOR_THEMES, FONT_KEYS, PETAL_TYPES, SECTION_KEYS } from '@/lib/theme';

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

export const MAIN_LAYOUTS = ['poster', 'polaroid', 'illustration', 'text'] as const;

export const MainSectionSchema = z
  .object({
    layout: z.enum(MAIN_LAYOUTS).default('poster'),
    heroImage: z.string().url().nullable().optional(),
    greeting: z.string().max(500).default(''),
    /** Free AI generation is one-shot; flips true after a successful run. */
    aiUsed: z.boolean().default(false),
  })
  .default({ layout: 'poster', greeting: '', aiUsed: false });

// ── basic info slide (글귀 / 인사말 / 가족 / 날짜) ──────────

export const ParentSchema = z.object({
  name: z.string().max(20).default(''),
  deceased: z.boolean().default(false),
});

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
  });

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
  groomName: z.string().min(1).max(20),
  brideName: z.string().min(1).max(20),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format expected')
    .nullable()
    .optional(),
});

export const UpdateInvitationSchema = z.object({
  groomName: z.string().min(1).max(20).optional(),
  brideName: z.string().min(1).max(20).optional(),
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
