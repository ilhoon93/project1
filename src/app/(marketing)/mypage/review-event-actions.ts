'use server';

/**
 * 포토리뷰 이벤트 제출(사용자) — 리뷰+아이디가 보이는 캡처본 업로드 + 참여 동의.
 *
 * 파일 업로드/행 upsert 는 service role(admin client)로 수행하되, user_id 는 세션에서
 * 검증한 값만 사용한다(임의 대리 제출 불가). 확인 완료된 건은 재제출 불가.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ReviewEventStatus {
  imageUrl: string;
  status: 'submitted' | 'confirmed';
  createdAt: string;
}

export async function submitReviewEvent(
  formData: FormData,
): Promise<{ ok: true; status: ReviewEventStatus } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const consent = formData.get('consent') === 'true';
  if (!consent)
    return { ok: false, error: '사례 소개 동의에 체크해야 참여할 수 있어요.' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: '캡처 이미지를 첨부해주세요.' };
  if (file.size > 12 * 1024 * 1024)
    return { ok: false, error: '이미지가 너무 큽니다(12MB 이하).' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return { ok: false, error: 'jpg/png/webp 이미지만 첨부할 수 있어요.' };

  const admin = createAdminClient();

  // 이미 확인 완료면 재제출 불가.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('review_event_submissions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing?.status === 'confirmed')
    return { ok: false, error: '이미 확인 완료된 참여예요.' };

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `review-events/${user.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: `업로드 실패: ${upErr.message}` };
  const { data: pub } = admin.storage.from('public-images').getPublicUrl(path);

  const createdAt = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rowErr } = await (admin as any)
    .from('review_event_submissions')
    .upsert(
      {
        user_id: user.id,
        image_url: pub.publicUrl,
        consent: true,
        status: 'submitted',
      },
      { onConflict: 'user_id' },
    );
  if (rowErr) return { ok: false, error: `저장 실패: ${rowErr.message}` };

  revalidatePath('/mypage');
  return {
    ok: true,
    status: { imageUrl: pub.publicUrl, status: 'submitted', createdAt },
  };
}
