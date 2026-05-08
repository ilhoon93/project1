import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/guest/gallery-like
 *
 * 갤러리 사진 하나에 좋아요 +1. (invitation, image_index) 단위 누적.
 */
const BodySchema = z.object({
  invitationId: z.string().uuid(),
  imageIndex: z.number().int().min(0).max(49),
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
  const { data, error } = await supabase.rpc('bump_gallery_like', {
    inv_id: body.invitationId,
    img_idx: body.imageIndex,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, count: data ?? null });
}
