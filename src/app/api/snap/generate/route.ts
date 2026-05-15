import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GPT_IMAGE_MODEL, submitMultiImageEdit } from '@/lib/fal/client';
import { findSnapCatalog } from '@/lib/snap/catalog';
import { getCatalogColorMeta } from '@/lib/snap/catalog-metadata';
import {
  buildCouplePhotoSnapPrompt,
  buildSoloCatalogPrompt,
  buildTogetherCatalogPrompt,
} from '@/lib/snap/prompt';
import { logSnapJobSubmit } from '@/lib/snap/jobs';
import { validateInputImage } from '@/lib/snap/input-validation';
import { preprocessAndUpload } from '@/lib/snap/input-preprocess';

/**
 * POST /api/snap/generate
 *
 * Solo anchor 아키텍처 + couple bypass 분기:
 *
 *   (1) mode='couple' → 커플 사진 직결 (anchor 무시)
 *       image_urls = [couplePhoto, catalogMaster]
 *       buildCouplePhotoSnapPrompt
 *
 *   (2) mode='anchor' (default for selfies users) →
 *       catalog.personality 에 따라 분기:
 *
 *       (2a) personality='together'   → [groom-anchor, bride-anchor, catalog] (3장)
 *                                       buildTogetherCatalogPrompt
 *       (2b) personality='groom-solo' → [groom-anchor, catalog] (2장)
 *                                       buildSoloCatalogPrompt('groom')
 *       (2c) personality='bride-solo' → [bride-anchor, catalog] (2장)
 *                                       buildSoloCatalogPrompt('bride')
 *
 *       필요한 anchor 가 없으면 400 + code='no_anchor' / 'no_anchor_slot'.
 *
 * 요금: 카탈로그 1장 = snap 크레딧 1 차감. 실패 시 환불.
 */

const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

const CoupleBodySchema = z.object({
  mode: z.literal('couple'),
  couplePhotoUrl: z.string().url(),
  catalogId: z.string().min(1),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

// 앵커 모드 — 저장된 anchor 사용.
// anchorId 미지정 또는 'current' → 현재 snap_anchors 행을 사용.
// UUID 지정 → snap_anchor_history 에서 해당 row 를 라이브러리 앵커로 사용.
const AnchoredOnlySchema = z.object({
  mode: z.literal('anchor'),
  catalogId: z.string().min(1),
  anchorId: z.union([z.literal('current'), z.string().uuid()]).optional(),
});

const BodySchema = z.union([AnchoredOnlySchema, CoupleBodySchema]);

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

  // Couple 모드 + solo 카탈로그 조합은 의미가 약함 (커플 사진에서 한 명만 추출
  // → face fidelity 저하). UI 에서도 hide 되지만 서버에서도 차단.
  if (input.mode === 'couple' && catalog.personality !== 'together') {
    return NextResponse.json(
      {
        error: '커플 사진 모드에서는 함께 컷만 생성 가능합니다. 단독 컷은 셀카 모드를 사용해주세요.',
        code: 'couple_solo_mismatch',
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // ── 앵커 모드면 anchor 로드 + personality 별 필요 slot 검증 ───
  //   anchorId 미지정 / 'current' → snap_anchors (가장 최근 active)
  //   UUID → snap_anchor_history 에서 해당 row (라이브러리 picker)
  let anchor: {
    groom_anchor_url: string | null;
    bride_anchor_url: string | null;
    groom_height_cm: number | null;
    groom_weight_kg: number | null;
    bride_height_cm: number | null;
    bride_weight_kg: number | null;
  } | null = null;
  if (input.mode === 'anchor') {
    const anchorId = input.anchorId ?? 'current';
    if (anchorId === 'current') {
      const { data } = await admin
        .from('snap_anchors')
        .select(
          'groom_anchor_url, bride_anchor_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      anchor = data;
    } else {
      // 라이브러리 — user_id 매칭은 RLS 가 아니라 직접 검증 (admin client 사용 중).
      const { data } = await admin
        .from('snap_anchor_history')
        .select(
          'groom_anchor_url, bride_anchor_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg',
        )
        .eq('id', anchorId)
        .eq('user_id', user.id)
        .maybeSingle();
      anchor = data;
    }
    if (!anchor) {
      return NextResponse.json(
        { error: '먼저 앵커를 생성하고 선택해주세요.', code: 'no_anchor' },
        { status: 400 },
      );
    }
    if (catalog.personality === 'together') {
      if (!anchor.groom_anchor_url || !anchor.bride_anchor_url) {
        return NextResponse.json(
          { error: '함께 컷에는 신랑 앵커와 신부 앵커가 모두 필요합니다.', code: 'no_anchor_slot' },
          { status: 400 },
        );
      }
    } else if (catalog.personality === 'groom-solo' && !anchor.groom_anchor_url) {
      return NextResponse.json(
        { error: '신랑 단독 컷에는 신랑 앵커가 필요합니다.', code: 'no_anchor_slot' },
        { status: 400 },
      );
    } else if (catalog.personality === 'bride-solo' && !anchor.bride_anchor_url) {
      return NextResponse.json(
        { error: '신부 단독 컷에는 신부 앵커가 필요합니다.', code: 'no_anchor_slot' },
        { status: 400 },
      );
    }
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

  // ── 카탈로그 마스터 URL ────────────────────────────────
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const catalogUrl = `${origin}${catalog.image}`;

  const groomBody =
    anchor?.groom_height_cm && anchor.groom_weight_kg
      ? { heightCm: anchor.groom_height_cm, weightKg: anchor.groom_weight_kg }
      : undefined;
  const brideBody =
    anchor?.bride_height_cm && anchor.bride_weight_kg
      ? { heightCm: anchor.bride_height_cm, weightKg: anchor.bride_weight_kg }
      : undefined;

  // 카탈로그 컬러 메타 (Phase 1+2 통합) — 추출 실패 시 null, 빌더가 graceful 처리.
  // sharp 로 카탈로그 마스터 LAB 평균 + 색온도 추정 → moodHint 문자열을 prompt 에 주입.
  const catalogMeta = await getCatalogColorMeta(input.catalogId);
  const catalogColorHint = catalogMeta?.moodHint ?? null;

  // ── image_urls + prompt 분기 ────────────────────────────
  let imageUrls: string[];
  let prompt: string;
  let pathLabel: 'anchored' | 'couple';

  if (input.mode === 'couple') {
    // 커플 사진 입력 검증 — 해상도/밝기 등 차단 조건. errors 면 400 반환.
    // 사용자에게 정확한 이유까지 한 줄로 보여 줘서 어떤 부분이 문제인지 즉시 파악 가능.
    const couplePhotoValidation = await validateInputImage(input.couplePhotoUrl);
    if (!couplePhotoValidation.ok) {
      return NextResponse.json(
        {
          error: `커플 사진: ${couplePhotoValidation.errors.join(', ')}\n다시 업로드해 주세요.`,
          details: couplePhotoValidation.errors.map((e) => `커플 사진: ${e}`),
          warnings: couplePhotoValidation.warnings.map((w) => `커플 사진: ${w}`),
          code: 'input_quality',
        },
        { status: 400 },
      );
    }
    // 커플 사진 선처리 — EXIF auto-rotate + 약한 화이트밸런스. 실패 시 원본 폴백.
    let couplePhotoUrl = input.couplePhotoUrl;
    try {
      const pp = await preprocessAndUpload(input.couplePhotoUrl, {
        pathPrefix: 'couple-photo',
      });
      couplePhotoUrl = pp.publicUrl;
    } catch (e) {
      console.warn('[snap/generate] couple photo preprocess failed', e);
    }
    imageUrls = [couplePhotoUrl, catalogUrl];
    prompt = buildCouplePhotoSnapPrompt({
      catalogPromptHint: catalog.promptHint,
      groom: input.groomBody,
      bride: input.brideBody,
      catalogColorHint,
    });
    pathLabel = 'couple';
  } else {
    pathLabel = 'anchored';
    if (catalog.personality === 'together') {
      imageUrls = [anchor!.groom_anchor_url!, anchor!.bride_anchor_url!, catalogUrl];
      prompt = buildTogetherCatalogPrompt({
        catalogPromptHint: catalog.promptHint,
        groom: groomBody,
        bride: brideBody,
        catalogColorHint,
      });
    } else if (catalog.personality === 'groom-solo') {
      imageUrls = [anchor!.groom_anchor_url!, catalogUrl];
      prompt = buildSoloCatalogPrompt({
        slot: 'groom',
        catalogPromptHint: catalog.promptHint,
        groom: groomBody,
        catalogColorHint,
      });
    } else {
      // bride-solo
      imageUrls = [anchor!.bride_anchor_url!, catalogUrl];
      prompt = buildSoloCatalogPrompt({
        slot: 'bride',
        catalogPromptHint: catalog.promptHint,
        bride: brideBody,
        catalogColorHint,
      });
    }
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

  // snap_jobs 로깅 — 본 흐름에 영향 없게 비동기.
  void logSnapJobSubmit({
    userId: user.id,
    kind: 'catalog',
    falRequestId: requestId,
    model: GPT_IMAGE_MODEL,
    quality: 'medium',
    catalogId: input.catalogId,
    catalogPath: pathLabel,
    creditDelta: -1,
  });

  return NextResponse.json({
    requestId,
    catalogId: input.catalogId,
    path: pathLabel,
    personality: catalog.personality,
    balance: consumeRes.balance,
  });
}
