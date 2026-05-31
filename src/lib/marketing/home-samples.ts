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
  DEFAULT_HOME_SAMPLES_CONFIG,
  DEFAULT_SAMPLE_CONFIGS,
  DEFAULT_TEMPLATE,
  buildDesign,
  type AiSnapItem,
  type BeforeAfterConfig,
  type HomeSamplesConfig,
  type SampleDesign,
} from './sample-invitations';

/** 랜딩에 바로 쓰는 해석된 결과. */
export interface HomeSamples {
  aiSnaps: AiSnapItem[];
  designs: SampleDesign[];
  beforeAfter: BeforeAfterConfig;
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
  voteQuestion: z.string(),
  voteOptions: z.array(z.string()),
  guestbookMessage: z.string(),
  accountGuide: z.string(),
  accountGroomBank: z.string(),
  accountGroomNumber: z.string(),
  accountBrideBank: z.string(),
  accountBrideNumber: z.string(),
  closing: z.string(),
});

const ConfigSchema = z.object({
  aiSnapCatalogIds: z.array(z.string()),
  designs: z.array(DesignConfigSchema),
  beforeAfter: BeforeAfterSchema.optional(),
  template: TemplateSchema.optional(),
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
    const { data, error } = await supabase
      .from('marketing_home_samples')
      .select('ai_snap_catalog_ids, designs, before_after, template')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return null;
    const parsed = ConfigSchema.safeParse({
      aiSnapCatalogIds: data.ai_snap_catalog_ids ?? [],
      designs: data.designs ?? [],
      beforeAfter: data.before_after ?? undefined,
      template: data.template ?? undefined,
    });
    if (!parsed.success) return null;
    return {
      aiSnapCatalogIds: parsed.data.aiSnapCatalogIds,
      designs: parsed.data.designs,
      beforeAfter: parsed.data.beforeAfter ?? DEFAULT_BEFORE_AFTER,
      template: parsed.data.template ?? DEFAULT_TEMPLATE,
    };
  } catch {
    return null;
  }
}

/**
 * 운영자 편집용 raw 설정. 노출 디자인 집합을 코드의 SEEDS(DEFAULT_SAMPLE_CONFIGS)
 * 에 고정한다:
 *   - DB 에 같은 id 의 편집본이 있으면 그 편집 내용을 우선 사용
 *   - 코드 SEEDS 에 없는 DB 전용 디자인(예: 단종된 sage/dusk/handwritten)은 제외
 *   - DB 에 아직 없는 신규 SEED 는 뒤에 자동 추가
 * 결과적으로 항상 코드 SEEDS 와 동일한 개수·순서(12개)가 노출돼, 코드에서 샘플을
 * 늘리거나 줄이면 admin/랜딩에 그대로 반영된다.
 */
export async function getHomeSamplesConfig(): Promise<HomeSamplesConfig> {
  const row = await readRow();
  if (!row || row.designs.length === 0) return DEFAULT_HOME_SAMPLES_CONFIG;

  const byId = new Map(row.designs.map((d) => [d.id, d]));
  // 코드 SEEDS 순서를 기준으로 — DB 편집본이 있으면 그것, 없으면 코드 기본값.
  const designs = DEFAULT_SAMPLE_CONFIGS.map((seed) => byId.get(seed.id) ?? seed);

  return {
    aiSnapCatalogIds: row.aiSnapCatalogIds.length
      ? row.aiSnapCatalogIds
      : DEFAULT_AI_SNAP_IDS,
    designs,
    beforeAfter: row.beforeAfter,
    template: row.template,
  };
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
  };
}

/** 설정 저장 (admin server action 에서 호출 — RLS 가 admin 만 통과). */
export async function saveHomeSamples(
  config: HomeSamplesConfig,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: 'invalid config' };
  const supabase = createClient();
  const { error } = await supabase.from('marketing_home_samples').upsert(
    {
      id: true,
      ai_snap_catalog_ids: parsed.data.aiSnapCatalogIds,
      designs: parsed.data.designs,
      before_after: parsed.data.beforeAfter,
      template: parsed.data.template,
    },
    { onConflict: 'id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
