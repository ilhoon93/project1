import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitMultiImageEdit } from '@/lib/fal/client';
import {
  ANCHOR_BASELINE,
  ANCHOR_TEMPLATES,
  type AnchorTemplate,
} from '@/lib/snap/anchor-templates';
import {
  buildAnchorPromptSelfies,
  buildAnchorPromptCouple,
} from '@/lib/snap/prompt';

/**
 * POST /api/snap/anchor/generate
 *
 * 앵커 후보 4장을 한 번에 큐에 제출한다. 4장은 서로 다른 framing (close-up /
 * half-body / full-body / 3-quarter) 으로 분산. 모두 high quality 로 — 평생
 * reference 자산이므로 비용 정당화.
 *
 * 요금 정책 (1회 무료 활성화):
 *   * 사용자의 snap_anchors 행이 없으면 → 무료. 새 행 insert.
 *   * 행이 있으면 → 재생성 batch. snap 크레딧 4개 차감 (1장당 1크레딧 환산).
 *
 * 응답: { requestIds: [{ templateId, requestId }], freeActivation: boolean }
 *
 * 클라이언트는 각 requestId 를 /api/snap/status 로 폴링하다 모두 COMPLETED 되면
 * fal CDN URL 을 받아 화면에 그리고, 사용자가 선택하면 POST /api/snap/anchor 로
 * 영구 저장한다.
 */

const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

// 셀카는 신랑/신부 각 1장 (정면) 또는 3장 (정면+좌45°+우45°). 3장 모드는
// 모델이 3D 얼굴을 더 정확히 잡아 측면/3-quarter 컷에서 정체성 안정성이 좋다.
const SelfieSchema = z.object({
  mode: z.literal('selfies'),
  groomFaceUrls: z.array(z.string().url()).min(1).max(3),
  brideFaceUrls: z.array(z.string().url()).min(1).max(3),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

const CoupleSchema = z.object({
  mode: z.literal('couple'),
  couplePhotoUrl: z.string().url(),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

const BodySchema = z.union([SelfieSchema, CoupleSchema]);

// 재생성 batch 1회 비용 (snap 크레딧).
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

  // 1. 무료 활성화 여부 — 기존 snap_anchors 행이 없으면 무료.
  const { data: existing } = await admin
    .from('snap_anchors')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const isFreeActivation = !existing;

  // 2. 유료 재생성이면 크레딧 4개 사전 차감 (원자적 RPC 4회 호출).
  if (!isFreeActivation) {
    for (let i = 0; i < REGEN_COST; i += 1) {
      const { data: consume } = await admin.rpc('consume_snap_credit', {
        p_user_id: user.id,
        p_note: `anchor_regen ${i + 1}/${REGEN_COST}`,
      });
      const res = consume as { ok?: boolean; balance?: number } | null;
      if (!res?.ok) {
        // 부분 차감 환불 — 멱등성 위해 ref_id 동일 batch id.
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

  // 3. 4 개 템플릿을 병렬로 fal 큐에 제출.
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  void origin; // origin 은 카탈로그 reference 가 없어 사용하지 않음

  const buildPrompt = (t: AnchorTemplate) => {
    const sceneHint = `${ANCHOR_BASELINE}\nFraming: ${t.framingHint}`;
    if (input.mode === 'couple') {
      return buildAnchorPromptCouple(sceneHint, {
        groom: input.groomBody,
        bride: input.brideBody,
      });
    }
    return buildAnchorPromptSelfies(sceneHint, {
      groom: input.groomBody,
      bride: input.brideBody,
      groomFaceCount: input.groomFaceUrls.length,
      brideFaceCount: input.brideFaceUrls.length,
    });
  };

  const imageUrls =
    input.mode === 'couple'
      ? [input.couplePhotoUrl]
      : [...input.groomFaceUrls, ...input.brideFaceUrls];

  let submissions: Array<{ templateId: AnchorTemplate['id']; requestId: string }>;
  try {
    submissions = await Promise.all(
      ANCHOR_TEMPLATES.map(async (t) => {
        const requestId = await submitMultiImageEdit({
          imageUrls,
          prompt: buildPrompt(t),
          quality: 'high',
          imageSize: 'portrait_4_3',
        });
        return { templateId: t.id, requestId };
      }),
    );
  } catch (e) {
    console.error('[snap/anchor/generate] fal.queue.submit error', e);
    // 유료였다면 환불 — 부분 성공 케이스도 보수적으로 전체 환불.
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

  // 4. snap_anchors 행을 upsert — image_url 은 아직 NULL (선택 전).
  //    체형 가이드와 source_mode 도 같이 저장해 카탈로그 단계에서 재사용.
  const upsertPayload = {
    user_id: user.id,
    image_url: null,
    source_mode: input.mode,
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
    // 이미 fal 제출은 일어났으므로 사용자에게는 정상 응답을 주되 서버 로그로 추적.
  }

  return NextResponse.json({
    requestIds: submissions,
    freeActivation: isFreeActivation,
  });
}
