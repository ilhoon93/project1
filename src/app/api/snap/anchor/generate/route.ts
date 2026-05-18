import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GPT_IMAGE_MODEL, submitMultiImageEdit } from '@/lib/fal/client';
import {
  ANCHOR_ATTIRE,
  ANCHOR_BASELINE,
  ANCHOR_TEMPLATES,
  expressionCueFor,
  type AnchorExpression,
  type AnchorFraming,
  type AnchorSlot,
  type AnchorTemplate,
} from '@/lib/snap/anchor-templates';
import { buildAnchorPromptSolo } from '@/lib/snap/prompt';
import { logSnapJobSubmit } from '@/lib/snap/jobs';
import { validateInputImage } from '@/lib/snap/input-validation';
import { preprocessUrlsParallel } from '@/lib/snap/input-preprocess';
import { buildFalWebhookUrl } from '@/lib/snap/fal-webhook';

/**
 * POST /api/snap/anchor/generate
 *
 * Solo anchor batch — slot 별 2 outputs (closeup + halfbody) 을 한 번에
 * fal 큐에 제출. slots 파라미터로 부분 재생성 가능:
 *   * slots = ['groom', 'bride'] (default): 4 outputs, full batch
 *   * slots = ['groom']: 2 outputs (신랑 closeup + halfbody)
 *   * slots = ['bride']: 2 outputs (신부 closeup + halfbody)
 *
 * 요금 정책 (마이그 015 적용 후):
 *   * 무료 full-batch: 사용자당 2회 (최초 + 재생성 1회). full batch 일 때만.
 *     snap_anchors.free_full_batches_used 카운터로 추적.
 *   * 부분 재생성은 항상 유료. 무료 quota 와 무관 (카운터 영향 없음).
 *   * 유료 batch: 1 output 당 1 크레딧 = slots 길이 × 2.
 *
 * 라이브러리 보존:
 *   * 새 batch 직전, 기존 snap_anchors 가 양쪽 URL 모두 채워진 "완성 앵커" 면
 *     snap_anchor_history 에 자동 복사. 사용자가 카탈로그 생성 시 과거 앵커도
 *     anchorId 로 골라 쓸 수 있게 함.
 *
 * 응답: { requestIds: [{ slot, framing, requestId }, ...], freeActivation, freeBatchesLeft }
 */

const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

const SlotsSchema = z.array(z.enum(['groom', 'bride'])).min(1).max(2);

const BodySchema = z.object({
  mode: z.literal('selfies'),
  // 부분 재생성용. default = 둘 다.
  slots: SlotsSchema.optional(),
  // 셀카 URL — slots 에 포함된 사람의 URL 만 필수.
  groomFaceUrls: z.array(z.string().url()).min(1).max(3).optional(),
  brideFaceUrls: z.array(z.string().url()).min(1).max(3).optional(),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
  // 표정 옵션 — 'neutral' (기본, 차분한 자연 표정), 'slight' (옅은 미소),
  // 'bright' (환하게 웃는 미소).
  expression: z.enum(['neutral', 'slight', 'bright']).optional(),
  // 레거시 호환 — 옛 클라이언트가 boolean 으로 보낼 수 있어 받아 둠.
  // expression 이 있으면 expression 이 우선.
  slightSmile: z.boolean().optional(),
});

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

  // 정규화: slots 미지정이면 둘 다.
  const slots: AnchorSlot[] = (input.slots ?? ['groom', 'bride']) as AnchorSlot[];
  const uniqueSlots = Array.from(new Set(slots));

  // 각 slot 에 해당하는 face URL 이 모두 있는지 검증.
  if (uniqueSlots.includes('groom') && (!input.groomFaceUrls || input.groomFaceUrls.length === 0)) {
    return NextResponse.json(
      { error: '신랑 슬롯을 재생성하려면 신랑 셀카가 필요합니다.', code: 'missing_groom_faces' },
      { status: 400 },
    );
  }
  if (uniqueSlots.includes('bride') && (!input.brideFaceUrls || input.brideFaceUrls.length === 0)) {
    return NextResponse.json(
      { error: '신부 슬롯을 재생성하려면 신부 셀카가 필요합니다.', code: 'missing_bride_faces' },
      { status: 400 },
    );
  }

  // 입력 검증 — 해상도/밝기/종횡비. errors 가 있으면 차단, warnings 는 응답에 포함.
  // 검증은 sharp 로컬, 추가 fal 비용 0원. 어느 사진이 문제인지 사용자가 정확히
  // 알 수 있도록 라벨 (예: "신랑 사진 2번") 을 붙여 detail 에 넘긴다.
  const ANGLE_LABELS = ['정면', '좌 45°', '우 45°'] as const;
  const labeledUrls: { label: string; url: string }[] = [
    ...(input.groomFaceUrls ?? []).map((url, i) => ({
      label: `신랑 사진 ${i + 1}번 (${ANGLE_LABELS[i] ?? `${i + 1}장`})`,
      url,
    })),
    ...(input.brideFaceUrls ?? []).map((url, i) => ({
      label: `신부 사진 ${i + 1}번 (${ANGLE_LABELS[i] ?? `${i + 1}장`})`,
      url,
    })),
  ];
  const validations = await Promise.all(
    labeledUrls.map((entry) => validateInputImage(entry.url)),
  );
  const errorDetails: string[] = [];
  const warningDetails: string[] = [];
  validations.forEach((v, i) => {
    const label = labeledUrls[i].label;
    if (!v.ok) {
      errorDetails.push(`${label}: ${v.errors.join(', ')}`);
    }
    if (v.warnings.length > 0) {
      warningDetails.push(`${label}: ${v.warnings.join(', ')}`);
    }
  });
  if (errorDetails.length > 0) {
    // 사용자 메시지 — 어떤 사진이 문제인지 명확히. detail 의 첫 줄은 그대로
    // 사용해 "어떤 사진이 어떤 이유로" 까지 한 번에 보이게.
    const firstLine = errorDetails[0];
    return NextResponse.json(
      {
        error: errorDetails.length === 1
          ? `${firstLine}\n다시 업로드해 주세요.`
          : `${errorDetails.length}장의 사진에 문제가 있어요:\n${errorDetails.join('\n')}\n해당 사진을 다시 업로드해 주세요.`,
        details: errorDetails,
        warnings: warningDetails,
        code: 'input_quality',
      },
      { status: 400 },
    );
  }

  // 입력 선처리 — EXIF auto-rotate + 약한 화이트밸런스. 결과 품질 영향 ≈ 0 또는 +.
  // 실패 시 원본 URL 유지 (silent fallback). face URLs 만 처리, body 정보엔 영향 없음.
  let preprocessedGroomUrls = input.groomFaceUrls;
  let preprocessedBrideUrls = input.brideFaceUrls;
  try {
    if (input.groomFaceUrls?.length) {
      preprocessedGroomUrls = await preprocessUrlsParallel(input.groomFaceUrls, {
        pathPrefix: 'groom-face',
      });
    }
    if (input.brideFaceUrls?.length) {
      preprocessedBrideUrls = await preprocessUrlsParallel(input.brideFaceUrls, {
        pathPrefix: 'bride-face',
      });
    }
  } catch (e) {
    // preprocessUrlsParallel 은 내부 fallback 처리하지만 만약을 대비.
    console.warn('[snap/anchor/generate] preprocess failed, using originals', e);
  }
  // 위 block 끝나면 preprocessedGroomUrls / preprocessedBrideUrls 가 채워져 있음.
  // 실패 시 원본 input.*FaceUrls 가 유지됨 (preprocessUrlsParallel 내부 폴백).
  // 아래 refUrlsBySlot 에서 이 변수들이 fal 호출에 들어감.

  const admin = createAdminClient();

  // 1. 무료 활성화 여부 — 결제한 사용자에게만 (마이그 016 정책).
  //    조건: has_purchased_snap == true && full batch && freeUsed < 2.
  //    부분 재생성은 카운터에 영향 없음 (항상 유료).
  //    미결제 사용자는 무료 batch 없음 — 첫 batch 부터 4 크레딧 필요.
  const [{ data: existing }, { data: hasPurchasedRaw }] = await Promise.all([
    admin
      .from('snap_anchors')
      .select(
        'last_batch_at, free_full_batches_used, groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, created_at',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.rpc('has_purchased_snap', { p_user_id: user.id }),
  ]);
  const hasPurchased = !!hasPurchasedRaw;
  const freeUsed = existing?.free_full_batches_used ?? 0;
  const isFullBatch = uniqueSlots.length === 2;
  const isFreeActivation = hasPurchased && isFullBatch && freeUsed < 2;

  // 2. 비용 계산 — 1 output 당 1 크레딧. slots 길이 × 2.
  const cost = isFreeActivation ? 0 : uniqueSlots.length * 2;

  // 2-1. 라이브러리 자동 보존 — 기존 snap_anchors 가 "완성 앵커" (양쪽 URL 모두 set)
  //      일 때만 history 에 복사. 부분 채워진 상태(batch 만 생성된 단계) 는 복사 X.
  //      카탈로그 생성 시 사용자가 라이브러리에서 어떤 앵커를 쓸지 선택할 수 있도록.
  if (existing?.groom_anchor_url && existing?.bride_anchor_url) {
    const { error: histErr } = await admin.from('snap_anchor_history').insert({
      user_id: user.id,
      groom_anchor_url: existing.groom_anchor_url,
      bride_anchor_url: existing.bride_anchor_url,
      // 마이그 017 — selfie 진본 reference 도 함께 보존해 라이브러리에서 선택해도
      // 카탈로그 단계에 face identity reference 가 살아 있게.
      groom_selfie_url: existing.groom_selfie_url ?? null,
      bride_selfie_url: existing.bride_selfie_url ?? null,
      source_mode: existing.source_mode,
      groom_height_cm: existing.groom_height_cm,
      groom_weight_kg: existing.groom_weight_kg,
      bride_height_cm: existing.bride_height_cm,
      bride_weight_kg: existing.bride_weight_kg,
      anchor_created_at: existing.created_at,
    });
    if (histErr) {
      // 보존 실패는 본 흐름 차단 X — 사용자가 새 anchor 만드는 걸 막지 말자.
      console.warn('[snap/anchor/generate] auto-archive failed', histErr);
    }
  }

  // 3. 유료라면 크레딧 사전 차감 (cost 만큼).
  if (cost > 0) {
    for (let i = 0; i < cost; i += 1) {
      const { data: consume } = await admin.rpc('consume_snap_credit', {
        p_user_id: user.id,
        p_note: `anchor_regen ${uniqueSlots.join('+')} ${i + 1}/${cost}`,
      });
      const res = consume as { ok?: boolean; balance?: number } | null;
      if (!res?.ok) {
        // 부분 차감 환불.
        for (let j = 0; j < i; j += 1) {
          await admin.rpc('refund_snap_credit', {
            p_user_id: user.id,
            p_note: 'anchor_regen rollback (insufficient balance)',
            p_ref_id: null,
          });
        }
        return NextResponse.json(
          {
            error: `앵커 ${isFullBatch ? '재생성' : '부분 재생성'}에는 ${cost} 스냅 크레딧이 필요합니다. 패키지를 구매해 주세요.`,
            code: 'insufficient_credits',
            requiredCredits: cost,
            currentBalance: res?.balance ?? 0,
          },
          { status: 402 },
        );
      }
    }
  }

  // 4. slots 에 포함된 템플릿만 골라 제출.
  const templates = ANCHOR_TEMPLATES.filter((t) => uniqueSlots.includes(t.slot));

  // 선처리된 URL 우선 사용 — 실패 시 원본 URL 로 폴백 (preprocessUrlsParallel 보장).
  const refUrlsBySlot: Record<AnchorSlot, string[] | undefined> = {
    groom: preprocessedGroomUrls,
    bride: preprocessedBrideUrls,
  };
  const bodyBySlot: Record<AnchorSlot, { heightCm: number; weightKg: number } | undefined> = {
    groom: input.groomBody,
    bride: input.brideBody,
  };

  // 표정 cue 결정 — expression 이 있으면 우선, 없으면 legacy slightSmile 로 폴백.
  const expression: AnchorExpression =
    input.expression ?? (input.slightSmile ? 'slight' : 'neutral');
  const expressionCue = expressionCueFor(expression);

  const buildPrompt = (t: AnchorTemplate) => {
    const baselineSceneHint = `${ANCHOR_BASELINE}\n${expressionCue}\n${ANCHOR_ATTIRE[t.slot]}\nFraming: ${t.framingHint}`;
    return buildAnchorPromptSolo({
      slot: t.slot,
      baselineSceneHint,
      faceCount: (refUrlsBySlot[t.slot] ?? []).length,
      body: bodyBySlot[t.slot],
    });
  };

  // webhookUrl 동봉 — fal 완료 시 /api/snap/fal-webhook 자동 호출. anchor 작업은
  // 사용자가 명시적 저장 액션을 해야 finalize 되므로 webhook 은 상태 노티로만 활용.
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const webhookUrl = buildFalWebhookUrl(origin, 'anchor');

  let submissions: Array<{ slot: AnchorSlot; framing: AnchorFraming; requestId: string }>;
  try {
    submissions = await Promise.all(
      templates.map(async (t) => {
        const faces = refUrlsBySlot[t.slot] ?? [];
        const requestId = await submitMultiImageEdit({
          imageUrls: faces,
          prompt: buildPrompt(t),
          quality: 'high',
          imageSize: 'portrait_4_3',
          ...(webhookUrl ? { webhookUrl } : {}),
        });
        void logSnapJobSubmit({
          userId: user.id,
          kind: 'anchor',
          falRequestId: requestId,
          model: GPT_IMAGE_MODEL,
          quality: 'high',
          anchorSlot: t.slot,
          anchorFraming: t.framing,
          creditDelta: isFreeActivation ? 0 : -1,
        });
        return { slot: t.slot, framing: t.framing, requestId };
      }),
    );
  } catch (e) {
    console.error('[snap/anchor/generate] fal.queue.submit error', e);
    if (cost > 0) {
      for (let i = 0; i < cost; i += 1) {
        await admin.rpc('refund_snap_credit', {
          p_user_id: user.id,
          p_note: 'anchor_regen rollback (submit failure)',
          p_ref_id: null,
        });
      }
    }
    const message =
      e instanceof Error && e.message.includes('FAL_KEY')
        ? 'AI 키 설정이 누락되었습니다. 관리자에게 문의해주세요.'
        : '앵커 작업 제출에 실패했습니다. 잠시 후 다시 시도해주세요.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 5. snap_anchors 행 upsert — 부분 재생성이면 기존 다른 slot URL 보존.
  //    last_batch_at 갱신 + 무료 full batch 였으면 카운터 +1.
  const nextFreeUsed = isFreeActivation ? freeUsed + 1 : freeUsed;
  const upsertPayload = {
    user_id: user.id,
    // 재생성 대상 slot 만 NULL 로 (선택 전 상태), 다른 slot 은 기존 값 유지.
    groom_anchor_url: uniqueSlots.includes('groom')
      ? null
      : existing?.groom_anchor_url ?? null,
    bride_anchor_url: uniqueSlots.includes('bride')
      ? null
      : existing?.bride_anchor_url ?? null,
    source_mode: 'selfies' as const,
    // body metrics 도 재생성 대상 slot 의 값으로 갱신. 다른 slot 은 기존 값.
    groom_height_cm: uniqueSlots.includes('groom')
      ? input.groomBody?.heightCm ?? existing?.groom_height_cm ?? null
      : existing?.groom_height_cm ?? null,
    groom_weight_kg: uniqueSlots.includes('groom')
      ? input.groomBody?.weightKg ?? existing?.groom_weight_kg ?? null
      : existing?.groom_weight_kg ?? null,
    bride_height_cm: uniqueSlots.includes('bride')
      ? input.brideBody?.heightCm ?? existing?.bride_height_cm ?? null
      : existing?.bride_height_cm ?? null,
    bride_weight_kg: uniqueSlots.includes('bride')
      ? input.brideBody?.weightKg ?? existing?.bride_weight_kg ?? null
      : existing?.bride_weight_kg ?? null,
    // 마이그 017 — 대표 selfie (preprocess 후 첫 번째 = 정면 frontal) URL 저장.
    // 카탈로그 생성 시 anchor 와 함께 face identity reference 로 사용. 재생성
    // 대상 slot 만 업데이트, 다른 slot 은 기존 값 보존.
    groom_selfie_url: uniqueSlots.includes('groom')
      ? preprocessedGroomUrls?.[0] ?? existing?.groom_selfie_url ?? null
      : existing?.groom_selfie_url ?? null,
    bride_selfie_url: uniqueSlots.includes('bride')
      ? preprocessedBrideUrls?.[0] ?? existing?.bride_selfie_url ?? null
      : existing?.bride_selfie_url ?? null,
    last_batch_at: new Date().toISOString(),
    free_full_batches_used: nextFreeUsed,
  };
  const { error: upsertErr } = await admin
    .from('snap_anchors')
    .upsert(upsertPayload, { onConflict: 'user_id' });
  if (upsertErr) {
    console.error('[snap/anchor/generate] upsert snap_anchors error', upsertErr);
  }

  return NextResponse.json({
    requestIds: submissions,
    freeActivation: isFreeActivation,
    slots: uniqueSlots,
    cost,
    expression,
    // 무료 full-batch 남은 횟수 (다음번 사용 가능한지). 0 이면 다음 full-batch 는 유료.
    freeBatchesLeft: Math.max(0, 2 - nextFreeUsed),
  });
}
