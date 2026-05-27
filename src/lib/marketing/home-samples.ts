/**
 * 랜딩 화면 샘플(AI스냅 + 알림장 디자인) 설정 read/write helper. (서버 전용)
 *
 * 저장소: public.marketing_home_samples (migration 033, 단일 행 id=true).
 * 권한: select 는 anon 포함 모두, 변경은 app_metadata.role='admin' 만 (RLS).
 *
 * 운영자 설정이 없거나(행 없음) 파싱 실패 시 코드 기본값으로 안전 폴백 —
 * 공개 랜딩이 어떤 경우에도 깨지지 않도록 한다.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { findSnapCatalog } from '@/lib/snap/catalog';
import { COLOR_THEMES, PETAL_TYPES, FONT_KEYS } from '@/lib/theme';
import { MAIN_LAYOUTS } from '@/types/invitation';
import {
  DEFAULT_AI_SNAP_IDS,
  DEFAULT_HOME_SAMPLES_CONFIG,
  DEFAULT_SAMPLE_CONFIGS,
  buildDesign,
  type AiSnapItem,
  type HomeSamplesConfig,
  type SampleDesign,
} from './sample-invitations';

/** 랜딩에 바로 쓰는 해석된 결과. */
export interface HomeSamples {
  aiSnaps: AiSnapItem[];
  designs: SampleDesign[];
}

const DesignConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  name: z.string(),
  layoutLabel: z.string().default(''),
  colorTheme: z.enum(COLOR_THEMES),
  petalType: z.enum(PETAL_TYPES),
  font: z.enum(FONT_KEYS),
  layout: z.enum(MAIN_LAYOUTS),
  heroImageId: z.string(),
  groomName: z.string(),
  brideName: z.string(),
  weddingDate: z.string(),
  greetingShort: z.string().default(''),
});

const ConfigSchema = z.object({
  aiSnapCatalogIds: z.array(z.string()),
  designs: z.array(DesignConfigSchema),
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
      .select('ai_snap_catalog_ids, designs')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return null;
    const parsed = ConfigSchema.safeParse({
      aiSnapCatalogIds: data.ai_snap_catalog_ids ?? [],
      designs: data.designs ?? [],
    });
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** 운영자 편집용 raw 설정 (없으면 코드 기본값 그대로). */
export async function getHomeSamplesConfig(): Promise<HomeSamplesConfig> {
  const row = await readRow();
  if (!row || row.designs.length === 0) return DEFAULT_HOME_SAMPLES_CONFIG;
  return {
    aiSnapCatalogIds: row.aiSnapCatalogIds.length
      ? row.aiSnapCatalogIds
      : DEFAULT_AI_SNAP_IDS,
    designs: row.designs,
  };
}

/** 랜딩에 바로 쓰는 해석된 샘플 (enabled 만, 비면 기본값 폴백). */
export async function getHomeSamples(): Promise<HomeSamples> {
  const cfg = await getHomeSamplesConfig();
  const designs = cfg.designs.filter((d) => d.enabled).map(buildDesign);
  const aiSnaps = resolveAiSnaps(cfg.aiSnapCatalogIds);
  return {
    designs: designs.length ? designs : DEFAULT_SAMPLE_CONFIGS.map(buildDesign),
    aiSnaps: aiSnaps.length ? aiSnaps : resolveAiSnaps(DEFAULT_AI_SNAP_IDS),
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
    },
    { onConflict: 'id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
