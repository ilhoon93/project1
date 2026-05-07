import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitImageEdit } from '@/lib/fal/client';
import { buildConceptPrompt, isConceptKey } from '@/lib/fal/concepts';

/**
 * POST /api/ai/concept-generate
 *
 * 큐 모드 진입점. 사용자가 업로드한 사진과 컨셉을 받아 fal.ai 큐에 작업을 제출하고
 * `requestId` 만 즉시 반환한다 (1–3초). 결과 폴링은 클라이언트가 별도 라우트로.
 *
 * 함수 호출 자체가 짧기 때문에 Vercel Hobby 의 60s 제한과 무관하게 동작.
 */

const BodySchema = z.object({
  photoUrl: z.string().url(),
  concept: z.string().refine(isConceptKey, { message: 'Unknown concept' }),
});

// 큐 제출은 짧지만 fal 측 응답이 느릴 수 있어 여유 있게 30초.
export const maxDuration = 30;

export async function POST(req: Request) {
  // 1. Auth — 네이버 로그인 필수.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Validate body.
  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. 사용자당 1회 제한 — service-role 로 ai_image_usage 조회.
  // 제출 시점에 한번 막고, 실제 사용 카운트 증가는 finalize 에서 한다 (제출 후 도중
  // 닫혔을 때 사용자가 손해 안 보도록).
  const admin = createAdminClient();
  const { data: usage } = await admin
    .from('ai_image_usage')
    .select('used_count')
    .eq('user_id', user.id)
    .maybeSingle();

  if (usage && usage.used_count >= 1) {
    return NextResponse.json(
      { error: 'AI 이미지 생성은 계정당 1회만 사용 가능합니다.', code: 'quota_exhausted' },
      { status: 403 },
    );
  }

  // 4. fal.ai 큐에 제출 → request_id 반환.
  let requestId: string;
  try {
    requestId = await submitImageEdit({
      imageUrl: input.photoUrl,
      prompt: buildConceptPrompt(input.concept),
    });
  } catch (e) {
    console.error('[ai/concept-generate] fal.queue.submit error', e);
    const message =
      e instanceof Error && e.message.includes('FAL_KEY')
        ? 'AI 키 설정이 누락되었습니다. 관리자에게 문의해주세요.'
        : '작업 제출에 실패했습니다. 잠시 후 다시 시도해주세요.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ requestId });
}

/**
 * GET /api/ai/concept-generate
 *
 * 클라이언트가 진입 시 잔여 사용 가능 여부 + 마지막 결과 이미지 URL 을 받아
 * UI 상태(생성 폼 vs 결과 표시) 를 분기하기 위해 사용.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from('ai_image_usage')
    .select('used_count, last_used_at, last_image_path')
    .eq('user_id', user.id)
    .maybeSingle();

  const used = !!usage && usage.used_count >= 1;
  const lastUrl = usage?.last_image_path
    ? admin.storage.from('public-images').getPublicUrl(usage.last_image_path).data.publicUrl
    : null;

  return NextResponse.json({ used, lastUrl, lastUsedAt: usage?.last_used_at ?? null });
}
