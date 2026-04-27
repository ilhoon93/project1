import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().max(20).optional(),
  questionIndex: z.number().int().min(0).max(10),
  selectedOption: z.number().int().min(0).max(10),
  isCorrect: z.boolean(),
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
  const { error } = await supabase.from('quiz_responses').insert({
    invitation_id: body.invitationId,
    visitor_name: body.visitorName ?? null,
    question_index: body.questionIndex,
    selected_option: body.selectedOption,
    is_correct: body.isCorrect,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
