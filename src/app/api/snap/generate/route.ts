import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitMultiImageEdit } from '@/lib/fal/client';
import { findSnapCatalog } from '@/lib/snap/catalog';
import {
  buildSnapPrompt,
  buildCouplePhotoSnapPrompt,
  buildAnchoredCatalogPrompt,
} from '@/lib/snap/prompt';

/**
 * POST /api/snap/generate
 *
 * 카탈로그 컷 1장 생성. 입력 모드 세 가지를 자동 분기.
 *
 *   (1) 사용자에게 저장된 anchor 가 있으면 → 무조건 anchor 경로
 *       image_urls = [anchorUrl, catalogMaster]  · buildAnchoredCatalogPrompt
 *       (가장 일관성 좋음 — 50컷 사이 정체성 안정. body metrics 도 앵커 저장값 재사용)
 *
 *   (2) anchor 없음 + mode='couple' 입력 → 커플 사진 경로
 *       image_urls = [couplePhoto, catalogMaster] · buildCouplePhotoSnapPrompt
 *
 *   (3) anchor 없음 + mode='selfies' 입력 (또는 legacy) → 셀카 직결 경로
 *       image_urls = [groomFace, brideFace, catalogMaster] · buildSnapPrompt
 *
 * 요금: 카탈로그 1장 = snap 크레딧 1 차감. 실패 시 환불.
 */

const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

const SelfieBodySchema = z.object({
  mode: z.literal('selfies'),
  groomFaceUrl: z.string().url(),
  brideFaceUrl: z.string().url(),
  catalogId: z.string().min(1),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

const CoupleBodySchema = z.object({
  mode: z.literal('couple'),
  couplePhotoUrl: z.string().url(),
  catalogId: z.string().min(1),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

// 앵커가 있는 사용자는 추가 입력 없이 catalogId 만 보내도 동작 (선택적으로 inputs).
const AnchoredOnlySchema = z.object({
  mode: z.literal('anchor'),
  catalogId: z.string().min(1),
});

// 구버전 클라이언트 — mode 누락 시 셀카 모드로 폴백.
const LegacySelfieBodySchema = SelfieBodySchema.omit({ mode: true }).transform((v) => ({
  ...v,
  mode: 'selfies' as const,
}));

const BodySchema = z.union([
  AnchoredOnlySchema,
  SelfieBodySchema,
  CoupleBodySchema,
  LegacySelfieBodySchema,
]);

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const catalog = findSnapCatalog(input.catalogId);
  if (!catalog) {
    return NextResponse.json({ error: 'Unknown catalog id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── 사용자 앵커 로드 (있으면 anchor 경로) ────────────────
  const { data: anchor } = await admin
    .from('snap_anchors')
    .select('image_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg')
    .eq('user_id', user.id)
    .maybeSingle();
  const hasAnchor = !!anchor?.image_url;

  // anchor 모드를 요청했는데 앵커가 없음 → 에러.
  if (input.mode === 'anchor' && !hasAnchor) {
    return NextResponse.json(
      { error: '먼저 앵커를 생성하고 선택해주세요.', code: 'no_anchor' },
      { status: 400 },
    );
  }

  // ── 크레딧 1 차감 (원자적) ─────────────────────────────
  const { data: consume } = await admin.rpc('consume_snap_credit', {
    p_user_id: user.id,
    p_note: `catalog ${input.catalogId}`,
  });
  const consumeRes = consume as { ok?: boolean; balance?: number } | null;
  if (!consumeRes?.ok) {
    return NextResponse.json(
      {
        error: '스냅 크레딧이 부족합니다. 패키지를 구매해 주세요.',
        code: 'insufficient_credits',
        currentBalance: consumeRes?.balance ?? 0,
      },
      { status: 402 },
    );
  }

  // ── 카탈로그 마스터 샘플 URL ────────────────────────────
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const catalogUrl = `${origin}${catalog.image}`;

  // ── image_urls + prompt 분기 ────────────────────────────
  // 앵커가 있으면 사용자 입력 모드와 무관하게 anchor 경로 — 일관성이 가장 좋음.
  // 앵커가 없으면 사용자 입력 모드에 따라 직결 경로.
  let imageUrls: string[];
  let prompt: string;
  if (hasAnchor && anchor?.image_url) {
    imageUrls = [anchor.image_url, catalogUrl];
    prompt = buildAnchoredCatalogPrompt({
      catalogPromptHint: catalog.promptHint,
      groom:
        anchor.groom_height_cm && anchor.groom_weight_kg
          ? { heightCm: anchor.groom_height_cm, weightKg: anchor.groom_weight_kg }
          : undefined,
      bride:
        anchor.bride_height_cm && anchor.bride_weight_kg
          ? { heightCm: anchor.bride_height_cm, weightKg: anchor.bride_weight_kg }
          : undefined,
    });
  } else if (input.mode === 'couple') {
    imageUrls = [input.couplePhotoUrl, catalogUrl];
    prompt = buildCouplePhotoSnapPrompt({
      catalogPromptHint: catalog.promptHint,
      groom: input.groomBody,
      bride: input.brideBody,
    });
  } else if (input.mode === 'selfies') {
    imageUrls = [input.groomFaceUrl, input.brideFaceUrl, catalogUrl];
    prompt = buildSnapPrompt({
      catalogPromptHint: catalog.promptHint,
      groom: input.groomBody,
      bride: input.brideBody,
    });
  } else {
    // 도달 불가 — anchor 모드인데 hasAnchor=false 인 경우는 위에서 차단됨.
    await admin.rpc('refund_snap_credit', {
      p_user_id: user.id,
      p_note: 'unreachable branch',
      p_ref_id: null,
    });
    return NextResponse.json({ error: 'Invalid input mode' }, { status: 400 });
  }

  // ── fal 큐 제출 ────────────────────────────────────────
  let requestId: string;
  try {
    requestId = await submitMultiImageEdit({
      imageUrls,
      prompt,
      quality: 'medium',
      imageSize: 'portrait_4_3',
    });
  } catch (e) {
    console.error('[snap/generate] fal.queue.submit error', e);
    // 제출 실패 → 차감한 크레딧 환불.
    await admin.rpc('refund_snap_credit', {
      p_user_id: user.id,
      p_note: 'submit failed',
      p_ref_id: null,
    });
    const message =
      e instanceof Error && e.message.includes('FAL_KEY')
        ? 'AI 키 설정이 누락되었습니다. 관리자에게 문의해주세요.'
        : '작업 제출에 실패했습니다. 잠시 후 다시 시도해주세요.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    requestId,
    catalogId: input.catalogId,
    anchoredPath: hasAnchor,
    balance: consumeRes.balance,
  });
}
