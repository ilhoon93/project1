import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { submitMultiImageEdit } from '@/lib/fal/client';
import { findSnapCatalog } from '@/lib/snap/catalog';
import { buildSnapPrompt } from '@/lib/snap/prompt';

/**
 * POST /api/snap/generate
 *
 * 멀티-이미지 모드로 fal.ai 큐에 작업 제출. 입력은 신랑/신부 얼굴 signed URL +
 * 카탈로그 id. 카탈로그 마스터 샘플 이미지는 public/wedding-snap/catalog/{id}.jpg
 * 에서 절대 URL 로 fal 에 전달한다.
 *
 * MVP 테스트 모드 — 결제/사용량 제한 없이 인증만 통과하면 호출 가능.
 * 추후 결제 검증을 추가할 때 본 라우트에 has-paid 체크만 끼워 넣으면 된다.
 */

// 체형 메타 — 두 명 모두 입력은 선택, 입력 시 키 140–210 cm / 몸무게 35–150 kg
// 범위로 가드. 한쪽만 입력해도 그쪽만 가이드로 들어간다.
const BodyMetricsSchema = z.object({
  heightCm: z.number().min(140).max(210),
  weightKg: z.number().min(35).max(150),
});

const BodySchema = z.object({
  groomFaceUrl: z.string().url(),
  brideFaceUrl: z.string().url(),
  catalogId: z.string().min(1),
  groomBody: BodyMetricsSchema.optional(),
  brideBody: BodyMetricsSchema.optional(),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  // 1. Auth
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Validate body
  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Catalog lookup
  const catalog = findSnapCatalog(input.catalogId);
  if (!catalog) {
    return NextResponse.json({ error: 'Unknown catalog id' }, { status: 400 });
  }

  // 4. 카탈로그 마스터 샘플 → 절대 URL.
  // fal.ai 가 외부에서 fetch 해야 하므로 origin 이 공개 도메인이어야 한다.
  // 로컬 개발(localhost) 에서는 fal 이 접근 불가하므로 vercel preview 등 공개
  // 배포 환경에서 테스트 권장. 이 점은 README 에 안내.
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const catalogUrl = `${origin}${catalog.image}`;

  // 5. fal 큐 제출
  let requestId: string;
  try {
    requestId = await submitMultiImageEdit({
      imageUrls: [input.groomFaceUrl, input.brideFaceUrl, catalogUrl],
      prompt: buildSnapPrompt({
        catalogPromptHint: catalog.promptHint,
        groom: input.groomBody,
        bride: input.brideBody,
      }),
      quality: 'medium',
      imageSize: 'portrait_4_3',
    });
  } catch (e) {
    console.error('[snap/generate] fal.queue.submit error', e);
    const message =
      e instanceof Error && e.message.includes('FAL_KEY')
        ? 'AI 키 설정이 누락되었습니다. 관리자에게 문의해주세요.'
        : '작업 제출에 실패했습니다. 잠시 후 다시 시도해주세요.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ requestId, catalogId: input.catalogId });
}
