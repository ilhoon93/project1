import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().min(1).max(20),
  visitorSide: z.enum(['groom', 'bride']).optional(),
  // base64 data URL ("data:image/png;base64,..."). 클라이언트는 가로 600px 로
  // 다운스케일한 PNG 를 보내므로 보통 50–150KB. 여유 있게 800KB 까지 허용.
  // 서명은 선택 항목 — 미서명 시 클라이언트가 null 을 보내므로 nullable 로 받는다
  // (optional 만 두면 null 이 검증에서 거부돼 400 이 났다).
  signatureData: z.string().max(800_000).nullable().optional(),
  consentPersonalInfo: z.boolean(),
});

export async function POST(req: Request) {
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 게스트 서명 입력은 service-role 로 RLS 우회 — invitation_is_active() 가
  // 마이그레이션/환경 차이로 거짓 음성을 낼 때 정상 입력이 차단되는 문제 회피.
  // 입력은 위 Zod 스키마로 sanitize 완료.
  const supabase = createAdminClient();
  const { error } = await supabase.from('signatures').insert({
    invitation_id: body.invitationId,
    visitor_name: body.visitorName,
    visitor_side: body.visitorSide ?? null,
    signature_data: body.signatureData ?? null,
    consent_personal_info: body.consentPersonalInfo,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
