import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UpdateInvitationSchema } from '@/types/invitation';
import type { Database } from '@/types/database';

type InvitationUpdate = Database['public']['Tables']['invitations']['Update'];
type PublicationUpdate = Database['public']['Tables']['publications']['Update'];

type RouteCtx = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ invitation: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let input;
  try {
    input = UpdateInvitationSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const update: InvitationUpdate = {};
  if (input.groomName !== undefined) update.groom_name = input.groomName;
  if (input.brideName !== undefined) update.bride_name = input.brideName;
  if (input.weddingDate !== undefined) update.wedding_date = input.weddingDate;
  if (input.content !== undefined) update.content = input.content;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // 발행된 알림장이면 quiz/vote 변경 시 응답 정합성을 처리한다.
  // - DB 의 현재 content 와 비교해 quiz/vote 객체가 달라졌는지 확인
  // - 응답이 존재하는데 클라이언트가 confirmDeleteResponses 플래그를 안 보냈으면 409 반환
  // - 플래그가 있으면 응답을 먼저 삭제하고 계속 진행
  const { data: existing } = await supabase
    .from('invitations')
    .select('id, content, is_published')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const confirmDelete = (body as { confirmDeleteResponses?: boolean })?.confirmDeleteResponses === true;
  if (input.content !== undefined && existing.is_published) {
    const oldContent = (existing.content ?? {}) as { quiz?: unknown; vote?: unknown };
    const newContent = input.content as { quiz?: unknown; vote?: unknown };
    const quizChanged = JSON.stringify(oldContent.quiz ?? null) !== JSON.stringify(newContent.quiz ?? null);
    const voteChanged = JSON.stringify(oldContent.vote ?? null) !== JSON.stringify(newContent.vote ?? null);

    if (quizChanged || voteChanged) {
      const [{ count: quizN }, { count: voteN }] = await Promise.all([
        quizChanged
          ? supabase
              .from('quiz_responses')
              .select('id', { count: 'exact', head: true })
              .eq('invitation_id', params.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        voteChanged
          ? supabase
              .from('vote_responses')
              .select('id', { count: 'exact', head: true })
              .eq('invitation_id', params.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ]);

      const totalResponses = (quizN ?? 0) + (voteN ?? 0);
      if (totalResponses > 0 && !confirmDelete) {
        return NextResponse.json(
          {
            error: 'Quiz/vote responses exist',
            requiresConfirmation: true,
            quizResponseCount: quizN ?? 0,
            voteResponseCount: voteN ?? 0,
          },
          { status: 409 },
        );
      }

      if (confirmDelete) {
        if (quizChanged && (quizN ?? 0) > 0) {
          await supabase.from('quiz_responses').delete().eq('invitation_id', params.id);
        }
        if (voteChanged && (voteN ?? 0) > 0) {
          await supabase.from('vote_responses').delete().eq('invitation_id', params.id);
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('invitations')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 발행된 알림장이면 활성 publication 의 content/이름/날짜도 동기화 → 게스트가 보는
  // URL 에 즉시 반영. 한 알림장당 활성 publication 은 1개로 정책 고정 (010 migration).
  if (existing.is_published) {
    const pubUpdate: PublicationUpdate = {};
    if (input.content !== undefined) pubUpdate.content = input.content;
    if (input.groomName !== undefined) pubUpdate.groom_name = input.groomName;
    if (input.brideName !== undefined) pubUpdate.bride_name = input.brideName;
    if (input.weddingDate !== undefined) pubUpdate.wedding_date = input.weddingDate;
    if (Object.keys(pubUpdate).length > 0) {
      await supabase
        .from('publications')
        .update(pubUpdate)
        .eq('invitation_id', params.id)
        .eq('user_id', user.id)
        .is('revoked_at', null);
    }
  }

  return NextResponse.json({ invitation: data });
}

/**
 * DELETE /api/invitations/[id]
 *
 * Hard-deletes the invitation. Cascades remove guest data and any
 * publications (so previously shared URLs go 404 immediately).
 *
 * Storage cleanup — public-images/invitations/{id}/** 의 모든 객체를 함께 삭제해
 * 고아 자산이 누적되지 않게 한다. Supabase Storage 는 prefix 일괄 삭제 API 가
 * 없어 list → delete 2 단계로 처리. 한 폴더 안의 깊이 1 ~ 2 단계만 사용하므로
 * 재귀 list 도 함께 수행.
 */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) 본인 소유 확인 (DELETE 가 RLS 로도 막히지만 명시적 체크).
  const { data: own } = await supabase
    .from('invitations')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 2) Storage prefix 일괄 삭제 — public-images/invitations/{id}/<folder>/<file>.
  await deleteStoragePrefix(supabase, 'public-images', `invitations/${params.id}`);

  // 3) DB 삭제 (cascade 로 publications, guest data 모두 정리).
  const { error, count } = await supabase
    .from('invitations')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}

/**
 * 주어진 prefix 아래 모든 객체를 삭제. Supabase Storage 는 list 가 1 단계만
 * 보여주므로 폴더를 발견하면 재귀 호출. 이 앱은 깊이 ≤ 2 (gallery/file.jpg,
 * story-2/file.jpg 등) 라 충분.
 *
 * 최선 노력 (best-effort) — 실패해도 throw 하지 않고 계속 진행.
 */
async function deleteStoragePrefix(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<void> {
  try {
    const { data: entries } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
    });
    if (!entries || entries.length === 0) return;

    const fileKeys: string[] = [];
    for (const entry of entries) {
      // 폴더는 id === null (Supabase 관행). 재귀.
      if (entry.id === null) {
        await deleteStoragePrefix(supabase, bucket, `${prefix}/${entry.name}`);
      } else {
        fileKeys.push(`${prefix}/${entry.name}`);
      }
    }
    if (fileKeys.length > 0) {
      await supabase.storage.from(bucket).remove(fileKeys);
    }
  } catch {
    // 실패는 조용히 무시 — DB 삭제가 더 중요.
  }
}
