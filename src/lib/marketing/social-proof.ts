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
import {
  InvitationContentSchema,
  type InvitationContent,
} from '@/types/invitation';

export interface SocialProofReview {
  id: string;
  /** (구버전 호환용) 리뷰 텍스트 마퀴에서는 사용하지 않음. */
  imageUrl: string;
  caption: string;
  /** 별점 (0~5). 0 이면 별점 없음으로 간주(평균에서 제외). */
  rating: number;
}

/** 사회적 증거에 흐르는 "알림장 메인 디자인 사진" 한 장. */
export interface SocialProofDesign {
  id: string;
  imageUrl: string;
}

/**
 * showcase 커버 — 실제 고객 알림장의 메인 디자인을 config 렌더로 그대로 보여주기
 * 위한 스냅샷. content.main.heroImage 에는 얼굴 위 스티커를 합성한 이미지 URL 이
 * 들어가고, 이름은 익명화(이니셜 등)된 상태로 저장된다. InvitationPreview 가
 * 그대로 소비할 수 있는 SampleDesign 형태.
 */
export interface ShowcaseCover {
  id: string;
  /** 원본 알림장 id — 중복 등록 방지·재편집 매칭용. */
  invitationId: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  /** 홈 노출 여부(관리자 토글). false 면 저장은 유지하되 홈에서 숨김. */
  hidden: boolean;
  content: InvitationContent;
}

export interface SocialProofConfig {
  enabled: boolean;
  heading: string;
  subheading: string;
  coupleCount: number;
  coupleCountSuffix: string;
  coupleCountCaption: string;
  /** 사회적 증거에 노출할 평균 별점(0~5). 0 이면 평점 타일 미노출. */
  averageRating: number;
  /** "만들어본 고객의 N%가 2주 내로 구매를 결정했어요" 타일/문구 노출 여부. */
  purchaseStatEnabled: boolean;
  /** 위 문구 템플릿. {pct} 자리에 자동 계산된 전환율(%)이 들어간다. */
  purchaseStatCaption: string;
  /** % 타일 하단 라벨. */
  purchaseStatLabel: string;
  /** 디자인 사진 마퀴(알림장 메인 디자인) — 정적 업로드 이미지(레거시). */
  designs: SocialProofDesign[];
  /** 디자인 사진 마퀴 — config 렌더 커버 스냅샷(스티커 익명화된 실제 고객 디자인). */
  covers: ShowcaseCover[];
  /** 리뷰 텍스트 마퀴(별점 + 문구). */
  reviews: SocialProofReview[];
}

export const DEFAULT_SOCIAL_PROOF: SocialProofConfig = {
  enabled: false,
  heading: '이미 우리다운으로 소식을 전한 커플들',
  subheading: '실제 사용자들의 후기예요.',
  coupleCount: 0,
  coupleCountSuffix: '쌍',
  coupleCountCaption: '누적 알림장 제작',
  averageRating: 5.0,
  purchaseStatEnabled: true,
  purchaseStatCaption: '만들어본 고객의 {pct}%가 2주 내로 구매를 결정했어요.',
  purchaseStatLabel: '2주 내 구매 결정',
  designs: [],
  covers: [],
  reviews: [],
};

const ShowcaseCoverSchema = z.object({
  id: z.string(),
  invitationId: z.string().default(''),
  groomName: z.string().default(''),
  brideName: z.string().default(''),
  weddingDate: z.string().default(''),
  hidden: z.boolean().default(false),
  content: InvitationContentSchema,
});

const ReviewSchema = z.object({
  id: z.string(),
  imageUrl: z.string().default(''),
  caption: z.string().default(''),
  // 구버전(별점 없던 저장본) 호환 — 기본 5점.
  rating: z.number().min(0).max(5).default(5),
});

const DesignSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
});

const ConfigSchema = z.object({
  enabled: z.boolean().default(false),
  heading: z.string().default(DEFAULT_SOCIAL_PROOF.heading),
  subheading: z.string().default(DEFAULT_SOCIAL_PROOF.subheading),
  coupleCount: z.number().int().min(0).default(0),
  coupleCountSuffix: z.string().default('쌍'),
  coupleCountCaption: z.string().default(''),
  averageRating: z.number().min(0).max(5).default(5),
  purchaseStatEnabled: z.boolean().default(true),
  purchaseStatCaption: z.string().default(DEFAULT_SOCIAL_PROOF.purchaseStatCaption),
  purchaseStatLabel: z.string().default(DEFAULT_SOCIAL_PROOF.purchaseStatLabel),
  designs: z.array(DesignSchema).default([]),
  // 개별 커버 파싱 실패(스키마 변화 등) 시 그 커버만 버리고 나머지는 유지.
  covers: z
    .array(z.unknown())
    .default([])
    .transform((arr) => {
      const out: ShowcaseCover[] = [];
      for (const c of arr) {
        const r = ShowcaseCoverSchema.safeParse(c);
        if (r.success) out.push(r.data);
      }
      return out;
    }),
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
      average_rating?: number | string;
      purchase_stat_enabled?: boolean;
      purchase_stat_caption?: string;
      purchase_stat_label?: string;
      designs?: unknown;
      covers?: unknown;
      reviews?: unknown;
    };
    const parsed = ConfigSchema.safeParse({
      enabled: row.enabled ?? false,
      heading: row.heading ?? DEFAULT_SOCIAL_PROOF.heading,
      subheading: row.subheading ?? DEFAULT_SOCIAL_PROOF.subheading,
      coupleCount: row.couple_count ?? 0,
      coupleCountSuffix: row.couple_count_suffix ?? '쌍',
      coupleCountCaption: row.couple_count_caption ?? '',
      // numeric 컬럼은 드라이버에 따라 문자열로 올 수 있어 Number() 로 정규화.
      averageRating: row.average_rating != null ? Number(row.average_rating) : 5,
      purchaseStatEnabled: row.purchase_stat_enabled ?? true,
      purchaseStatCaption:
        row.purchase_stat_caption ?? DEFAULT_SOCIAL_PROOF.purchaseStatCaption,
      purchaseStatLabel:
        row.purchase_stat_label ?? DEFAULT_SOCIAL_PROOF.purchaseStatLabel,
      designs: row.designs ?? [],
      covers: row.covers ?? [],
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
    average_rating: parsed.data.averageRating,
    purchase_stat_enabled: parsed.data.purchaseStatEnabled,
    purchase_stat_caption: parsed.data.purchaseStatCaption,
    purchase_stat_label: parsed.data.purchaseStatLabel,
    designs: parsed.data.designs,
    covers: parsed.data.covers,
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

/**
 * 랜딩 사회적 증거 "커플 수" — 발행된 알림장 건수를 10단위로 올림한 값.
 * public_published_couple_count() RPC(056)로 건수를 읽어 Math.ceil(n/10)*10.
 * 실패 시 0 폴백(0 이면 커플 수 타일은 미노출).
 */
export async function getPublishedCoupleCount(): Promise<number> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('public_published_couple_count');
    const n = typeof data === 'number' ? data : 0;
    if (error || n <= 0) return 0;
    return Math.ceil(n / 10) * 10;
  } catch {
    return 0;
  }
}

/**
 * "만들어본 고객의 N%가 2주 내로 구매를 결정했어요" 의 N — 제작→결제 전환율(%).
 * public_purchase_conversion_pct() RPC(061). 통계 페이지의 정의와 동일
 * (미결제 & 최종수정 2주 미만 건 제외). 실패·0 이면 0 폴백(문구/타일 미노출).
 */
export async function getPurchaseConversionPct(): Promise<number> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('public_purchase_conversion_pct');
    const n = typeof data === 'number' ? data : 0;
    if (error || n <= 0) return 0;
    return n;
  } catch {
    return 0;
  }
}
