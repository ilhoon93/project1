import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GPT_IMAGE_MODEL, submitMultiImageEdit } from '@/lib/fal/client';
import {
  ANCHOR_ATTIRE,
  ANCHOR_BASELINE,
  ANCHOR_EXPRESSION_NEUTRAL,
  ANCHOR_EXPRESSION_SLIGHT_SMILE,
  ANCHOR_TEMPLATES,
  type AnchorFraming,
  type AnchorSlot,
  type AnchorTemplate,
} from '@/lib/snap/anchor-templates';
import { buildAnchorPromptSolo } from '@/lib/snap/prompt';
import { logSnapJobSubmit } from '@/lib/snap/jobs';

/**
 * POST /api/snap/anchor/generate
 *
 * Solo anchor batch — slot 별 2 outputs (closeup + halfbody) 을 한 번에
 * fal 큐에 제출. slots 파라미터로 부분 재생성 가능:
 *   * slots = ['groom', 'bride'] (default): 4 outputs, full batch
 *   * slots = ['groom']: 2 outputs (신랑 closeup + halfbody)
 *   * slots = ['bride']: 2 outputs (신부 closeup + halfbody)
 *
 * 요금 정책:
 *   * 첫 batch (snap_anchors 없거나 last_batch_at NULL): 무료. 단,
 *     full batch 일 때만 — 부분 재생성은 항상 유료.
 *   * 재생성 batch: 1 output 당 1 크레딧 (slots 길이 × 2). 즉
 *     groom only = 2, bride only = 2, both = 4.
 *
 * 응답: { requestIds: [{ slot, framing, requestId }, ...], freeActivation: boolean }
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
  // 사용자 옵션 — 체크하면 약간 미소 표정, 안 하면 차분한 자연 표정.
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

  const admin = createAdminClient();

  // 1. 무료 활성화 여부 — snap_anchors 행이 없거나 last_batch_at NULL.
  //    부분 재생성은 항상 유료 — 무료 quota 는 full batch 만 적용.
  const { data: existing } = await admin
    .from('snap_anchors')
    .select('last_batch_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const isFreshUser = !existing || existing.last_batch_at === null;
  const isFullBatch = uniqueSlots.length === 2;
  const isFreeActivation = isFreshUser && isFullBatch;

  // 2. 비용 계산 — 1 output 당 1 크레딧. slots 길이 × 2.
  const cost = isFreeActivation ? 0 : uniqueSlots.length * 2;

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

  const refUrlsBySlot: Record<AnchorSlot, string[] | undefined> = {
    groom: input.groomFaceUrls,
    bride: input.brideFaceUrls,
  };
  const bodyBySlot: Record<AnchorSlot, { heightCm: number; weightKg: number } | undefined> = {
    groom: input.groomBody,
    bride: input.brideBody,
  };

  // 옵션 미선택 = 차분한 자연 표정. 선택 = 옅은 미소.
  const expressionCue = input.slightSmile
    ? ANCHOR_EXPRESSION_SLIGHT_SMILE
    : ANCHOR_EXPRESSION_NEUTRAL;

  const buildPrompt = (t: AnchorTemplate) => {
    const baselineSceneHint = `${ANCHOR_BASELINE}\n${expressionCue}\n${ANCHOR_ATTIRE[t.slot]}\nFraming: ${t.framingHint}`;
    return buildAnchorPromptSolo({
      slot: t.slot,
      baselineSceneHint,
      faceCount: (refUrlsBySlot[t.slot] ?? []).length,
      body: bodyBySlot[t.slot],
    });
  };

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
  //    last_batch_at 갱신해 무료 quota 소진 처리.
  const { data: currentRow } = await admin
    .from('snap_anchors')
    .select('groom_anchor_url, bride_anchor_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg')
    .eq('user_id', user.id)
    .maybeSingle();

  const upsertPayload = {
    user_id: user.id,
    // 재생성 대상 slot 만 NULL 로 (선택 전 상태), 다른 slot 은 기존 값 유지.
    groom_anchor_url: uniqueSlots.includes('groom')
      ? null
      : currentRow?.groom_anchor_url ?? null,
    bride_anchor_url: uniqueSlots.includes('bride')
      ? null
      : currentRow?.bride_anchor_url ?? null,
    source_mode: 'selfies' as const,
    // body metrics 도 재생성 대상 slot 의 값으로 갱신. 다른 slot 은 기존 값.
    groom_height_cm: uniqueSlots.includes('groom')
      ? input.groomBody?.heightCm ?? currentRow?.groom_height_cm ?? null
      : currentRow?.groom_height_cm ?? null,
    groom_weight_kg: uniqueSlots.includes('groom')
      ? input.groomBody?.weightKg ?? currentRow?.groom_weight_kg ?? null
      : currentRow?.groom_weight_kg ?? null,
    bride_height_cm: uniqueSlots.includes('bride')
      ? input.brideBody?.heightCm ?? currentRow?.bride_height_cm ?? null
      : currentRow?.bride_height_cm ?? null,
    bride_weight_kg: uniqueSlots.includes('bride')
      ? input.brideBody?.weightKg ?? currentRow?.bride_weight_kg ?? null
      : currentRow?.bride_weight_kg ?? null,
    last_batch_at: new Date().toISOString(),
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
  });
}
