import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GPT_IMAGE_MODEL, submitMultiImageEdit } from '@/lib/fal/client';
import {
  ANCHOR_ATTIRE,
  ANCHOR_BASELINE,
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
 * Solo anchor batch — 한 번에 4 outputs (groom × 2 framings + bride × 2 framings).
 * 모두 high quality 로 — 평생 reference 자산이라 비용 정당화.
 *
 * 요금 정책 (1회 무료 활성화):
 *   * snap_anchors 행이 없거나 last_batch_at 이 NULL → 무료 (첫 batch)
 *   * 그 외 → 재생성 batch. snap 크레딧 4 차감 (1 output 당 1 환산)
 *
 * 응답:
 *   { requestIds: [{ slot, framing, requestId }, ...], freeActivation: boolean }
 *
 * 클라이언트는 각 requestId 를 /api/snap/status 로 폴링하다 모두 COMPLETED 시
 * fal CDN URL 을 받아 4장 그리드로 표시, 사용자가 신랑 row + 신부 row 에서
 * 각 1장씩 선택 후 POST /api/snap/anchor 로 영구 저장.
 */

const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

// 셀카는 신랑/신부 각 1장 (정면) 또는 3장 (정면+좌45°+우45°).
const BodySchema = z.object({
  mode: z.literal('selfies'),
  groomFaceUrls: z.array(z.string().url()).min(1).max(3),
  brideFaceUrls: z.array(z.string().url()).min(1).max(3),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

const REGEN_COST = 4;

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

  const admin = createAdminClient();

  // 1. 무료 활성화 여부 — snap_anchors 행이 없거나 last_batch_at NULL.
  //    (마이그레이션 013 이 기존 사용자 last_batch_at 을 NULL 로 리셋해 무료 quota 재부여)
  const { data: existing } = await admin
    .from('snap_anchors')
    .select('last_batch_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const isFreeActivation = !existing || existing.last_batch_at === null;

  // 2. 유료 재생성이면 크레딧 4개 사전 차감.
  if (!isFreeActivation) {
    for (let i = 0; i < REGEN_COST; i += 1) {
      const { data: consume } = await admin.rpc('consume_snap_credit', {
        p_user_id: user.id,
        p_note: `anchor_regen ${i + 1}/${REGEN_COST}`,
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
            error: '앵커 재생성에는 4 스냅 크레딧이 필요합니다. 패키지를 구매해 주세요.',
            code: 'insufficient_credits',
            requiredCredits: REGEN_COST,
            currentBalance: res?.balance ?? 0,
          },
          { status: 402 },
        );
      }
    }
  }

  // 3. slot 별 reference image_urls 분기.
  const refUrlsBySlot: Record<AnchorSlot, string[]> = {
    groom: input.groomFaceUrls,
    bride: input.brideFaceUrls,
  };
  const bodyBySlot: Record<AnchorSlot, { heightCm: number; weightKg: number } | undefined> = {
    groom: input.groomBody,
    bride: input.brideBody,
  };

  const buildPrompt = (t: AnchorTemplate) => {
    const baselineSceneHint = `${ANCHOR_BASELINE}\n${ANCHOR_ATTIRE[t.slot]}\nFraming: ${t.framingHint}`;
    return buildAnchorPromptSolo({
      slot: t.slot,
      baselineSceneHint,
      faceCount: refUrlsBySlot[t.slot].length,
      body: bodyBySlot[t.slot],
    });
  };

  let submissions: Array<{ slot: AnchorSlot; framing: AnchorFraming; requestId: string }>;
  try {
    submissions = await Promise.all(
      ANCHOR_TEMPLATES.map(async (t) => {
        const requestId = await submitMultiImageEdit({
          imageUrls: refUrlsBySlot[t.slot],
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
    if (!isFreeActivation) {
      for (let i = 0; i < REGEN_COST; i += 1) {
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

  // 4. snap_anchors 행 upsert — anchor URL 들은 아직 NULL (선택 전).
  const upsertPayload = {
    user_id: user.id,
    groom_anchor_url: null,
    bride_anchor_url: null,
    source_mode: 'selfies' as const,
    groom_height_cm: input.groomBody?.heightCm ?? null,
    groom_weight_kg: input.groomBody?.weightKg ?? null,
    bride_height_cm: input.brideBody?.heightCm ?? null,
    bride_weight_kg: input.brideBody?.weightKg ?? null,
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
  });
}
