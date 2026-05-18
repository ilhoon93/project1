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
  buildSoloPromptOnly,
  buildTogetherCatalogPrompt,
  buildTogetherPromptOnly,
} from '@/lib/snap/prompt';
import { logSnapJobSubmit } from '@/lib/snap/jobs';
import { getSnapImageQuality } from '@/lib/snap/quality';
import { validateInputImage } from '@/lib/snap/input-validation';
import { preprocessAndUpload } from '@/lib/snap/input-preprocess';
import { buildFalWebhookUrl } from '@/lib/snap/fal-webhook';
import { hasRequiredConsent } from '@/lib/snap/consent';
import {
  getCatalogFaceBlurMode,
  getBlurredCatalogUrl,
} from '@/lib/snap/catalog-face-blur';

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

// 커플 모드도 anchor 모드와 동일한 imageReference 토글 지원:
//   - 'strict'      : 카탈로그 마스터 이미지를 함께 전달 (의상/배경 충실도 우선)
//   - 'prompt-only' : 마스터 이미지 빼고 sanitized 텍스트로만 scene 지시
//                     (얼굴 보존 강함 — 마스터의 다른 모델 얼굴/포즈 leak 차단)
const CoupleBodySchema = z.object({
  mode: z.literal('couple'),
  couplePhotoUrl: z.string().url(),
  catalogId: z.string().min(1),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
  imageReference: z.enum(['strict', 'prompt-only']).optional(),
});

// 앵커 모드 — 저장된 anchor 사용.
// anchorId 미지정 또는 'current' → 현재 snap_anchors 행을 사용.
// UUID 지정 → snap_anchor_history 에서 해당 row 를 라이브러리 앵커로 사용.
//
// imageReference (default 'strict'):
//   - 'strict'      : 카탈로그 마스터를 모델 입력에 함께 전달 (포즈/구도 재현 강함)
//   - 'prompt-only' : 카탈로그 마스터를 빼고 promptHint 텍스트만으로 scene 지시
//                     (얼굴 보존 우선, 포즈 재현은 텍스트 해석에 의존)
const AnchoredOnlySchema = z.object({
  mode: z.literal('anchor'),
  catalogId: z.string().min(1),
  anchorId: z.union([z.literal('current'), z.string().uuid()]).optional(),
  imageReference: z.enum(['strict', 'prompt-only']).optional(),
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

  // 동의 게이트 — 필수 scope (personal_info + ai_generation) 동의가 현재 버전
  // 이상으로 있어야 진행. 한국 PIPA / ICN 법 대응.
  if (!(await hasRequiredConsent(user.id))) {
    return NextResponse.json(
      {
        error: '얼굴 정보 처리 및 AI 합성에 대한 동의가 필요합니다.',
        code: 'consent_required',
      },
      { status: 403 },
    );
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
  //
  // Phase A: anchor URL 외에 selfie URL 도 함께 가져옴 — fal 단계에서 anchor 는
  // 체형/포즈 ref, selfie 는 face identity ref 로 역할 분리해 2단계 합성 누적
  // identity drift 를 줄인다.
  let anchor: {
    groom_anchor_url: string | null;
    bride_anchor_url: string | null;
    groom_selfie_url: string | null;
    bride_selfie_url: string | null;
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
          'groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      anchor = data;
    } else {
      // 라이브러리 — user_id 매칭은 RLS 가 아니라 직접 검증 (admin client 사용 중).
      const { data } = await admin
        .from('snap_anchor_history')
        .select(
          'groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg',
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
  // Phase C 토글 (SNAP_CATALOG_FACE_BLUR=on) 면 카탈로그 마스터의 얼굴 영역을
  // 사전 blur 한 버전 사용 — 모델이 catalog 의 다른 얼굴에 끌려가지 X.
  // off 또는 catalog 에 faceMaskRegions 미정의면 원본 그대로 통과.
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const originalCatalogUrl = `${origin}${catalog.image}`;
  const faceBlurMode = getCatalogFaceBlurMode();
  const catalogUrl =
    faceBlurMode === 'on'
      ? await getBlurredCatalogUrl(input.catalogId, originalCatalogUrl)
      : originalCatalogUrl;

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
  // 커플 모드 한정 — finalize 의 face-swap restore / similarity 측정에
  // 사용할 (선처리된) 커플 사진 URL. 모드가 아니면 null 유지.
  let coupleStoredPhotoUrl: string | null = null;
  // 입력 사진 검증 메타 — snap_jobs 로깅에 전달해서 어떤 입력 조건에서 어떤 결과가
  // 나왔는지 추적 가능하게 한다.
  let inputMeta: {
    faceCount: number | null;
    minFaceSize: number | null;
    avgLuminance: number;
  } | null = null;

  if (input.mode === 'couple') {
    // 커플 사진 입력 검증 — 해상도/밝기 + 얼굴 2명 검출 / 얼굴 크기 임계.
    // errors 면 400 반환. 사용자에게 정확한 이유까지 한 줄로 보여 줘서 어떤 부분이
    // 문제인지 즉시 파악 가능.
    const couplePhotoValidation = await validateInputImage(input.couplePhotoUrl, {
      faceDetection: true,
      expectedFaces: 2,
    });
    inputMeta = {
      faceCount: couplePhotoValidation.meta.faceCount,
      minFaceSize: couplePhotoValidation.meta.minFaceSize,
      avgLuminance: couplePhotoValidation.meta.avgLuminance,
    };
    // 진단 로그 — face_count / min_face_size 가 NULL 로 들어가는 케이스 추적.
    // detectFaces 가 실패하면 meta.faceCount = null 이고 ok 는 여전히 true 일 수 있음.
    console.info('[snap/generate] couple input validation', {
      ok: couplePhotoValidation.ok,
      faceCount: couplePhotoValidation.meta.faceCount,
      minFaceSize: couplePhotoValidation.meta.minFaceSize,
      avgLuminance: couplePhotoValidation.meta.avgLuminance,
      errors: couplePhotoValidation.errors,
      warnings: couplePhotoValidation.warnings,
    });
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
        userId: user.id,
      });
      couplePhotoUrl = pp.publicUrl;
    } catch (e) {
      console.warn('[snap/generate] couple photo preprocess failed', e);
    }
    // finalize 단계 face-swap restore / similarity 측정에 사용할 URL 저장.
    coupleStoredPhotoUrl = couplePhotoUrl;
    // imageReference 분기:
    //   strict      → 마스터 이미지 동봉 (의상/배경 시각 reference)
    //   prompt-only → 마스터 빼고 텍스트만 (얼굴 보존 우선)
    const coupleImageReference = input.imageReference ?? 'strict';
    if (coupleImageReference === 'prompt-only') {
      imageUrls = [couplePhotoUrl];
    } else {
      imageUrls = [couplePhotoUrl, catalogUrl];
    }
    prompt = buildCouplePhotoSnapPrompt({
      catalogPromptHint: catalog.promptHint,
      groom: input.groomBody,
      bride: input.brideBody,
      catalogColorHint,
      includeMasterImage: coupleImageReference === 'strict',
    });
    pathLabel = 'couple';
  } else {
    pathLabel = 'anchored';
    // imageReference 분기 — strict 는 카탈로그 마스터를 모델 입력에 포함,
    // prompt-only 는 마스터 빼고 promptHint 텍스트로만 scene 지시.
    const imageReference = input.imageReference ?? 'strict';
    const isPromptOnly = imageReference === 'prompt-only';

    // Phase A — anchor 옆에 selfie 진본을 함께 fal 에 전달. selfie 가 없으면
    // (구버전 anchor 또는 라이브러리) anchor 만 사용하는 폴백.
    if (catalog.personality === 'together') {
      const groomSelfie = anchor!.groom_selfie_url;
      const brideSelfie = anchor!.bride_selfie_url;
      const hasSelfies = !!groomSelfie && !!brideSelfie;

      if (isPromptOnly) {
        // 마스터 미참조 — anchor (+ selfie) 만 입력. catalogUrl 안 넘김.
        imageUrls = hasSelfies
          ? [
              anchor!.groom_anchor_url!,
              anchor!.bride_anchor_url!,
              groomSelfie!,
              brideSelfie!,
            ]
          : [anchor!.groom_anchor_url!, anchor!.bride_anchor_url!];
        prompt = buildTogetherPromptOnly({
          catalogPromptHint: catalog.promptHint,
          groom: groomBody,
          bride: brideBody,
          catalogColorHint,
          includeSelfieRefs: hasSelfies,
        });
      } else {
        imageUrls = hasSelfies
          ? [
              anchor!.groom_anchor_url!,
              anchor!.bride_anchor_url!,
              groomSelfie!,
              brideSelfie!,
              catalogUrl,
            ]
          : [anchor!.groom_anchor_url!, anchor!.bride_anchor_url!, catalogUrl];
        prompt = buildTogetherCatalogPrompt({
          catalogPromptHint: catalog.promptHint,
          groom: groomBody,
          bride: brideBody,
          catalogColorHint,
          includeSelfieRefs: hasSelfies,
        });
      }
    } else if (catalog.personality === 'groom-solo') {
      const selfie = anchor!.groom_selfie_url;
      if (isPromptOnly) {
        imageUrls = selfie
          ? [anchor!.groom_anchor_url!, selfie]
          : [anchor!.groom_anchor_url!];
        prompt = buildSoloPromptOnly({
          slot: 'groom',
          catalogPromptHint: catalog.promptHint,
          groom: groomBody,
          catalogColorHint,
          includeSelfieRef: !!selfie,
        });
      } else {
        imageUrls = selfie
          ? [anchor!.groom_anchor_url!, selfie, catalogUrl]
          : [anchor!.groom_anchor_url!, catalogUrl];
        prompt = buildSoloCatalogPrompt({
          slot: 'groom',
          catalogPromptHint: catalog.promptHint,
          groom: groomBody,
          catalogColorHint,
          includeSelfieRef: !!selfie,
        });
      }
    } else {
      // bride-solo
      const selfie = anchor!.bride_selfie_url;
      if (isPromptOnly) {
        imageUrls = selfie
          ? [anchor!.bride_anchor_url!, selfie]
          : [anchor!.bride_anchor_url!];
        prompt = buildSoloPromptOnly({
          slot: 'bride',
          catalogPromptHint: catalog.promptHint,
          bride: brideBody,
          catalogColorHint,
          includeSelfieRef: !!selfie,
        });
      } else {
        imageUrls = selfie
          ? [anchor!.bride_anchor_url!, selfie, catalogUrl]
          : [anchor!.bride_anchor_url!, catalogUrl];
        prompt = buildSoloCatalogPrompt({
          slot: 'bride',
          catalogPromptHint: catalog.promptHint,
          bride: brideBody,
          catalogColorHint,
          includeSelfieRef: !!selfie,
        });
      }
    }
  }

  // ── fal 큐 제출 — gpt-image-2 multi-image edit ──────────
  // webhookUrl 동봉 시 fal 완료 시점에 자동으로 /api/snap/fal-webhook 호출돼
  // finalize 가 즉시 트리거됨. polling (poll-pending) 은 fallback 으로 유지.
  const webhookUrl = buildFalWebhookUrl(origin, 'catalog');
  const imageQuality = getSnapImageQuality();
  let requestId: string;
  try {
    requestId = await submitMultiImageEdit({
      imageUrls,
      prompt,
      quality: imageQuality,
      imageSize: 'portrait_4_3',
      ...(webhookUrl ? { webhookUrl } : {}),
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

  // snap_jobs 로깅 — await 로 인덱스에 잡힌 row 가 실제로 만들어진 뒤 응답.
  // (과거 void 호출은 Vercel 서버리스에서 응답 직후 freeze 되어 INSERT 자체가
  // 컷오프 → input_face_*, quality, image_reference 가 NULL 로 남는 원인이었음.
  // 응답 latency 가 ~50–200ms 늘어나지만 데이터 일관성 우선.)
  const resolvedImageReference = input.imageReference ?? 'strict';
  await logSnapJobSubmit({
    userId: user.id,
    kind: 'catalog',
    falRequestId: requestId,
    model: GPT_IMAGE_MODEL,
    quality: imageQuality,
    catalogId: input.catalogId,
    catalogPath: pathLabel,
    creditDelta: -1,
    inputFaceCount: inputMeta?.faceCount ?? null,
    inputFaceMinSize: inputMeta?.minFaceSize ?? null,
    inputAvgLuminance: inputMeta?.avgLuminance ?? null,
    imageReference: resolvedImageReference,
  });
  console.info('[snap/generate] job submitted', {
    falRequestId: requestId,
    catalogId: input.catalogId,
    pathLabel,
    quality: imageQuality,
    imageReference: resolvedImageReference,
    inputFaceCount: inputMeta?.faceCount ?? null,
    inputFaceMinSize: inputMeta?.minFaceSize ?? null,
  });

  // 커플 모드: finalize 단계의 face-swap restore / similarity 측정에 사용할
  // 커플 사진 URL 을 snap_jobs 에 별도 저장. await 로 처리해 logSnapJobSubmit
  // → patch 순서가 보장되고 응답 후 컷오프되지 않음.
  if (input.mode === 'couple' && coupleStoredPhotoUrl) {
    const { error: patchErr } = await admin
      .from('snap_jobs')
      .update({
        couple_photo_url: coupleStoredPhotoUrl,
        // path 저장은 PR 3 (private storage) 머지 후 별도 작업. 우선 URL 만.
      } as never)
      .eq('fal_request_id', requestId);
    if (patchErr) console.warn('[snap/generate] couple url patch failed', patchErr);
  }

  return NextResponse.json({
    requestId,
    catalogId: input.catalogId,
    path: pathLabel,
    personality: catalog.personality,
    balance: consumeRes.balance,
  });
}
