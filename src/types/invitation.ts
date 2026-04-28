import { z } from 'zod';
import { COLOR_THEMES, FONT_KEYS, PETAL_TYPES, SECTION_KEYS } from '@/lib/theme';

// ── theme (global look & feel + page ordering) ────────────

export const ThemeSchema = z
  .object({
    colorTheme: z.enum(COLOR_THEMES).default('cream'),
    petalType: z.enum(PETAL_TYPES).default('flower'),
    font: z.enum(FONT_KEYS).default('serif'),
    // Stored as plain strings so adding new section keys later doesn't break
    // existing data; reconcilePageOrder() in lib/theme.ts normalizes at render time.
    pageOrder: z.array(z.string()).default([...SECTION_KEYS]),
  })
  .default({
    colorTheme: 'cream',
    petalType: 'flower',
    font: 'serif',
    pageOrder: [...SECTION_KEYS],
  });

// ── individual section schemas ────────────────────────────

export const MAIN_LAYOUTS = ['poster', 'polaroid', 'illustration', 'text'] as const;

export const MainSectionSchema = z
  .object({
    layout: z.enum(MAIN_LAYOUTS).default('poster'),
    heroImage: z.string().url().nullable().optional(),
    greeting: z.string().max(500).default(''),
  })
  .default({ layout: 'poster', greeting: '' });

export const StoryChapterSchema = z.object({
  title: z.enum(['첫 만남', '고백', '프로포즈']),
  image: z.string().url().nullable().optional(),
  text: z.string().max(300).default(''),
});

export const StorySectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    chapters: z.array(StoryChapterSchema).length(3),
  })
  .default({
    enabled: true,
    chapters: [
      { title: '첫 만남', text: '' },
      { title: '고백', text: '' },
      { title: '프로포즈', text: '' },
    ],
  });

export const GallerySectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    images: z.array(z.string().url()).max(20).default([]),
  })
  .default({ enabled: true, images: [] });

export const VideoSectionSchema = z
  .object({
    enabled: z.boolean().default(false),
    url: z.string().url().nullable().default(null),
  })
  .default({ enabled: false, url: null });

export const QuizQuestionSchema = z.object({
  q: z.string().min(1).max(100),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
});

export const QuizSectionSchema = z
  .object({
    enabled: z.boolean().default(false),
    questions: z.array(QuizQuestionSchema).max(2).default([]),
  })
  .default({ enabled: false, questions: [] });

export const VoteQuestionSchema = z.object({
  q: z.string().min(1).max(100),
  options: z.array(z.string().min(1)).length(2),
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

export const BankAccountSchema = z.object({
  bank: z.string().min(1).max(20),
  number: z.string().min(1).max(30),
  holder: z.string().min(1).max(20),
});

export const AccountSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    groom: z.array(BankAccountSchema).max(3).default([]),
    bride: z.array(BankAccountSchema).max(3).default([]),
  })
  .default({ enabled: true, groom: [], bride: [] });

// ── full invitation content ──────────────────────────────

export const InvitationContentSchema = z.object({
  theme: ThemeSchema,
  main: MainSectionSchema,
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
