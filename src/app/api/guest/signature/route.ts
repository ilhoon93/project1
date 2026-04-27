import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().min(1).max(20),
  visitorSide: z.enum(['groom', 'bride']).optional(),
  // base64 data URL ("data:image/png;base64,...") — kept ≤ 200 KB
  signatureData: z.string().max(200_000).optional(),
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
