import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().min(1).max(20),
  visitorSide: z.enum(['groom', 'bride']).optional(),
  // base64 data URL ("data:image/png;base64,..."). 클라이언트는 가로 600px 로
  // 다운스케일한 PNG 를 보내므로 보통 50–150KB. 여유 있게 800KB 까지 허용.
  signatureData: z.string().max(800_000).optional(),
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

  const supabase = createClient();
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
