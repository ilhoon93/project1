/**
 * 랜딩 "알림장 소개" 섹션 사회적 증거(리뷰 이미지 + 커플 수 등) 설정 read/write.
 * (서버 전용)
 *
 * 저장소: public.marketing_social_proof (migration 051, 단일 행 id=true).
 * 권한: select 는 anon 포함 모두, 변경은 app_metadata.role='admin' 만 (RLS).
 *
 * 설정이 없거나 파싱 실패 시 코드 기본값으로 안전 폴백. 현재는 관리자에서 세팅만
 * 하고 실제 메인 렌더는 아직 연결하지 않는다(enabled 기본 false).
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface SocialProofReview {
  id: string;
  imageUrl: string;
  caption: string;
  /** 별점 (0~5). 0 이면 별점 없음으로 간주(평균에서 제외). */
  rating: number;
}

export interface SocialProofConfig {
  enabled: boolean;
  heading: string;
  subheading: string;
  coupleCount: number;
  coupleCountSuffix: string;
  coupleCountCaption: string;
  reviews: SocialProofReview[];
}

export const DEFAULT_SOCIAL_PROOF: SocialProofConfig = {
  enabled: false,
  heading: '이미 우리다운으로 소식을 전한 커플들',
  subheading: '실제 사용자들의 후기예요.',
  coupleCount: 0,
  coupleCountSuffix: '쌍',
  coupleCountCaption: '누적 알림장 제작',
  reviews: [],
};

const ReviewSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  caption: z.string().default(''),
  // 구버전(별점 없던 저장본) 호환 — 기본 5점.
  rating: z.number().min(0).max(5).default(5),
});

const ConfigSchema = z.object({
  enabled: z.boolean().default(false),
  heading: z.string().default(DEFAULT_SOCIAL_PROOF.heading),
  subheading: z.string().default(DEFAULT_SOCIAL_PROOF.subheading),
  coupleCount: z.number().int().min(0).default(0),
  coupleCountSuffix: z.string().default('쌍'),
  coupleCountCaption: z.string().default(''),
  reviews: z.array(ReviewSchema).default([]),
});

/**
 * 사회적 증거 설정 읽기 — 없거나 파싱 실패 시 코드 기본값.
 * (마이그 051 미적용 등 예외는 삼켜 폴백)
 */
export async function getSocialProof(): Promise<SocialProofConfig> {
  try {
    const supabase = createClient();
    // marketing_social_proof 는 자동생성 DB 타입(051 미반영)에 아직 없어 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('marketing_social_proof')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return DEFAULT_SOCIAL_PROOF;
    const row = data as unknown as {
      enabled?: boolean;
      heading?: string;
      subheading?: string;
      couple_count?: number;
      couple_count_suffix?: string;
      couple_count_caption?: string;
      reviews?: unknown;
    };
    const parsed = ConfigSchema.safeParse({
      enabled: row.enabled ?? false,
      heading: row.heading ?? DEFAULT_SOCIAL_PROOF.heading,
      subheading: row.subheading ?? DEFAULT_SOCIAL_PROOF.subheading,
      coupleCount: row.couple_count ?? 0,
      coupleCountSuffix: row.couple_count_suffix ?? '쌍',
      coupleCountCaption: row.couple_count_caption ?? '',
      reviews: row.reviews ?? [],
    });
    if (!parsed.success) return DEFAULT_SOCIAL_PROOF;
    return parsed.data;
  } catch {
    return DEFAULT_SOCIAL_PROOF;
  }
}

/** 설정 저장 (admin server action 에서 호출 — RLS 가 admin 만 통과). */
export async function saveSocialProof(
  config: SocialProofConfig,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: 'invalid config' };
  const supabase = createClient();
  const upsertRow = {
    id: true,
    enabled: parsed.data.enabled,
    heading: parsed.data.heading,
    subheading: parsed.data.subheading,
    couple_count: parsed.data.coupleCount,
    couple_count_suffix: parsed.data.coupleCountSuffix,
    couple_count_caption: parsed.data.coupleCountCaption,
    reviews: parsed.data.reviews,
  };
  // marketing_social_proof 는 자동생성 DB 타입(051 미반영)에 아직 없어 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('marketing_social_proof')
    .upsert(upsertRow, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
