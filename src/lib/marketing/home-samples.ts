/**
 * 랜딩 화면 샘플(AI스냅 + 알림장 디자인 + Before/After + 공유 본문 템플릿) 설정
 * read/write helper. (서버 전용)
 *
 * 저장소: public.marketing_home_samples (migration 033/034, 단일 행 id=true).
 * 권한: select 는 anon 포함 모두, 변경은 app_metadata.role='admin' 만 (RLS).
 *
 * 운영자 설정이 없거나(행 없음/컬럼 null) 파싱 실패 시 코드 기본값으로 안전 폴백 —
 * 공개 랜딩이 어떤 경우에도 깨지지 않도록 한다.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { findSnapCatalog } from '@/lib/snap/catalog';
import { COLOR_THEMES, PETAL_TYPES, FONT_KEYS } from '@/lib/theme';
import { MainSectionSchema } from '@/types/invitation';
import {
  DEFAULT_AI_SNAP_IDS,
  DEFAULT_BEFORE_AFTER,
  DEFAULT_EXAMPLE_FLOW,
  DEFAULT_HOME_SAMPLES_CONFIG,
  DEFAULT_SAMPLE_CONFIGS,
  DEFAULT_TEMPLATE,
  buildDesign,
  type AiSnapItem,
  type BeforeAfterConfig,
  type ExampleFlowConfig,
  type HomeSamplesConfig,
  type SampleDesign,
} from './sample-invitations';

/** 랜딩에 바로 쓰는 해석된 결과. */
export interface HomeSamples {
  aiSnaps: AiSnapItem[];
  designs: SampleDesign[];
  beforeAfter: BeforeAfterConfig;
  /** 메인 ShowcaseTabs "소장용 URL" 모달 "예시 열기" 버튼 URL — 관리자 세팅. */
  ownerUrlExample: string;
  /** AI 스냅 예시보기 팝업 설정. */
  exampleFlow: ExampleFlowConfig;
}

const DesignConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  name: z.string(),
  layoutLabel: z.string().default(''),
  colorTheme: z.enum(COLOR_THEMES),
  petalType: z.enum(PETAL_TYPES),
  font: z.enum(FONT_KEYS),
  heroImageId: z.string(),
  groomName: z.string(),
  brideName: z.string(),
  weddingDate: z.string(),
  main: MainSectionSchema,
  // 샘플 배경음악 (선택) — 구버전 호환 위해 optional.
  bgm: z.object({ enabled: z.boolean(), url: z.string() }).optional(),
});

const BeforeAfterStyleSchema = z.object({
  id: z.string(),
  styleCatalogId: z.string().optional(),
  label: z.string(),
  afterLabel: z.string(),
  afterImage: z.string(),
});

const BeforeAfterSchema = z.object({
  beforeImage: z.string(),
  styles: z.array(BeforeAfterStyleSchema),
});

const ExampleFlowSelfiePersonSchema = z.object({
  rowTitle: z.string(),
  selfies: z.array(z.string()),
  anchor: z.string(),
  catalogId: z.string(),
  result: z.string(),
  resultSubLabel: z.string(),
});
const ExampleFlowSchema = z.object({
  selfies: z.object({
    desc: z.string(),
    groom: ExampleFlowSelfiePersonSchema,
    bride: ExampleFlowSelfiePersonSchema,
    together: z.object({
      rowTitle: z.string(),
      catalogId: z.string(),
      result: z.string(),
      resultSubLabel: z.string(),
    }),
  }),
  couple: z.object({
    desc: z.string(),
    rows: z.array(
      z.object({
        rowTitle: z.string(),
        input: z.string(),
        aCatalogId: z.string(),
        aResult: z.string(),
        aSubLabel: z.string(),
        bCatalogId: z.string(),
        bResult: z.string(),
        bSubLabel: z.string(),
      }),
    ),
  }),
});

const TemplateChapterSchema = z.object({
  title: z.string(),
  text: z.string(),
  imageId: z.string(),
});

const TemplateSchema = z.object({
  basicGreeting: z.string(),
  basicQuote: z.string(),
  storyChapters: z.array(TemplateChapterSchema),
  galleryImageIds: z.array(z.string()),
  quizQuestion: z.string(),
  quizOptions: z.array(z.string()),
  quizAnswer: z.number().int().min(0).max(3),
  // 두 번째 퀴즈 — 구버전 호환 default.
  quiz2Question: z.string().default(''),
  quiz2Options: z.array(z.string()).default(['', '', '', '']),
  quiz2Answer: z.number().int().min(0).max(3).default(0),
  voteQuestion: z.string(),
  voteOptions: z.array(z.string()),
  // 두 번째 투표 — 구버전 호환 default.
  vote2Question: z.string().default(''),
  vote2Options: z.array(z.string()).default(['', '']),
  // 영상 — 구버전 저장본 호환 위해 optional + 기본값.
  videoTitle: z.string().default('우리의 영상'),
  videoUrl: z.string().default(''),
  guestbookMessage: z.string(),
  accountGuide: z.string(),
  accountGroomBank: z.string(),
  accountGroomNumber: z.string(),
  accountBrideBank: z.string(),
  accountBrideNumber: z.string(),
  // 부모 계좌 6 측 — 구버전 호환 default(빈 문자열).
  accountGroomFatherBank: z.string().default(''),
  accountGroomFatherNumber: z.string().default(''),
  accountGroomMotherBank: z.string().default(''),
  accountGroomMotherNumber: z.string().default(''),
  accountBrideFatherBank: z.string().default(''),
  accountBrideFatherNumber: z.string().default(''),
  accountBrideMotherBank: z.string().default(''),
  accountBrideMotherNumber: z.string().default(''),
  closing: z.string(),
});

const ConfigSchema = z.object({
  aiSnapCatalogIds: z.array(z.string()),
  designs: z.array(DesignConfigSchema),
  // 관리자에서 세팅한 owner URL 예시 (옵션). 구버전 호환 default ''.
  ownerUrlExample: z.string().default(''),
  beforeAfter: BeforeAfterSchema.optional(),
  template: TemplateSchema.optional(),
  exampleFlow: ExampleFlowSchema.optional(),
});

function resolveAiSnaps(ids: string[]): AiSnapItem[] {
  return ids.map((id) => ({
    id,
    label: findSnapCatalog(id)?.label ?? id,
    src: `/wedding-snap/catalog/${id}.jpg`,
  }));
}

/** DB 행 읽기 — 없거나 비정상이면 null. (예외는 삼켜 폴백) */
async function readRow(): Promise<HomeSamplesConfig | null> {
  try {
    const supabase = createClient();
    // owner_url_example 컬럼은 036 마이그에서 추가. DB 타입(자동생성)이 아직
    // 갱신되지 않은 환경 호환을 위해 select 컬럼 문자열을 좁힌 후 row 만 캐스팅.
    // 마이그 미적용 환경에선 supabase 가 컬럼 없음 에러를 던져 outer catch 가 null 폴백.
    const { data, error } = await supabase
      .from('marketing_home_samples')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('*' as any)
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as {
      ai_snap_catalog_ids: string[] | null;
      designs: unknown;
      before_after?: unknown;
      template?: unknown;
      owner_url_example?: string | null;
      example_flow?: unknown;
    };
    const parsed = ConfigSchema.safeParse({
      aiSnapCatalogIds: row.ai_snap_catalog_ids ?? [],
      designs: row.designs ?? [],
      ownerUrlExample: row.owner_url_example ?? '',
      beforeAfter: row.before_after ?? undefined,
      template: row.template ?? undefined,
      exampleFlow: row.example_flow ?? undefined,
    });
    if (!parsed.success) return null;
    return {
      aiSnapCatalogIds: parsed.data.aiSnapCatalogIds,
      designs: parsed.data.designs,
      ownerUrlExample: parsed.data.ownerUrlExample,
      beforeAfter: parsed.data.beforeAfter ?? DEFAULT_BEFORE_AFTER,
      template: parsed.data.template ?? DEFAULT_TEMPLATE,
      exampleFlow: parsed.data.exampleFlow ?? DEFAULT_EXAMPLE_FLOW,
    };
  } catch {
    return null;
  }
}

/**
 * 운영자 편집용 raw 설정. 노출 디자인 집합을 코드의 SEEDS(DEFAULT_SAMPLE_CONFIGS)
 * 에 고정한다:
 *   - DB 에 같은 id 의 편집본이 있으면 그 편집 내용을 우선 사용
 *   - DB 에 저장된 순서 그대로 사용 (운영자가 admin 에서 ▲/▼ 로 바꾼 순서 보존)
 *   - 코드 SEEDS 에 없는 DB 전용 디자인(예: 단종된 sage/dusk/handwritten)은 제외
 *   - DB 에 아직 없는 신규 SEED 는 뒤에 자동 추가
 * 결과적으로 운영자 정렬은 유지되면서, 코드에서 SEED 가 늘면 자동으로 합쳐진다.
 */
export async function getHomeSamplesConfig(): Promise<HomeSamplesConfig> {
  const row = await readRow();
  if (!row || row.designs.length === 0) return DEFAULT_HOME_SAMPLES_CONFIG;

  const seedIds = new Set(DEFAULT_SAMPLE_CONFIGS.map((s) => s.id));
  // 1) DB 에 저장된 순서대로, 단 코드 SEEDS 에 있는 id 만 (단종 디자인 제외).
  const rowOrdered = row.designs.filter((d) => seedIds.has(d.id));
  // 2) DB 에 없는 코드 신규 SEED 만 뒤에 추가.
  const dbIds = new Set(rowOrdered.map((d) => d.id));
  const newDefaults = DEFAULT_SAMPLE_CONFIGS.filter((s) => !dbIds.has(s.id));
  const designs = [...rowOrdered, ...newDefaults];

  return {
    aiSnapCatalogIds: row.aiSnapCatalogIds.length
      ? row.aiSnapCatalogIds
      : DEFAULT_AI_SNAP_IDS,
    designs,
    ownerUrlExample: row.ownerUrlExample ?? '',
    beforeAfter: row.beforeAfter,
    template: row.template,
    exampleFlow: row.exampleFlow ?? DEFAULT_EXAMPLE_FLOW,
  };
}

/** AI 스냅 예시보기 팝업 설정만 가볍게 읽는다 (create 페이지 → SnapGenerator 용). */
export async function getExampleFlow(): Promise<ExampleFlowConfig> {
  const row = await readRow();
  return row?.exampleFlow ?? DEFAULT_EXAMPLE_FLOW;
}

/** 랜딩에 바로 쓰는 해석된 샘플 (enabled 만, 비면 기본값 폴백). */
export async function getHomeSamples(): Promise<HomeSamples> {
  const cfg = await getHomeSamplesConfig();
  const designs = cfg.designs
    .filter((d) => d.enabled)
    .map((d) => buildDesign(d, cfg.template));
  const aiSnaps = resolveAiSnaps(cfg.aiSnapCatalogIds);
  return {
    designs: designs.length
      ? designs
      : DEFAULT_SAMPLE_CONFIGS.map((d) => buildDesign(d, cfg.template)),
    aiSnaps: aiSnaps.length ? aiSnaps : resolveAiSnaps(DEFAULT_AI_SNAP_IDS),
    beforeAfter: cfg.beforeAfter ?? DEFAULT_BEFORE_AFTER,
    ownerUrlExample: cfg.ownerUrlExample ?? '',
    exampleFlow: cfg.exampleFlow ?? DEFAULT_EXAMPLE_FLOW,
  };
}

/** 설정 저장 (admin server action 에서 호출 — RLS 가 admin 만 통과). */
export async function saveHomeSamples(
  config: HomeSamplesConfig,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: 'invalid config' };
  const supabase = createClient();
  const upsertRow = {
    id: true,
    ai_snap_catalog_ids: parsed.data.aiSnapCatalogIds,
    designs: parsed.data.designs,
    owner_url_example: parsed.data.ownerUrlExample,
    before_after: parsed.data.beforeAfter,
    template: parsed.data.template,
    example_flow: parsed.data.exampleFlow,
  };
  // DB 타입(자동생성)이 owner_url_example 컬럼을 아직 모르는 환경 호환 위해 캐스팅.
  const { error } = await supabase.from('marketing_home_samples').upsert(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsertRow as any,
    { onConflict: 'id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
