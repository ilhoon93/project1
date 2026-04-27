import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().max(20).optional(),
  visitorSide: z.enum(['groom', 'bride']).optional(),
  deviceType: z.enum(['mobile', 'desktop']).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  slidesViewed: z.array(z.string().max(40)).max(20).optional(),
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

  // RLS: insert allowed only for active (published, non-expired) invitations.
  const supabase = createClient();
  const { error } = await supabase.from('guest_visits').insert({
    invitation_id: body.invitationId,
    visitor_name: body.visitorName ?? null,
    visitor_side: body.visitorSide ?? null,
    device_type: body.deviceType ?? null,
    duration_seconds: body.durationSeconds ?? null,
    slides_viewed: body.slidesViewed ?? [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
