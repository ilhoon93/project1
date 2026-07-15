'use server';

/**
 * /admin/showcase server actions — admin role 만 통과.
 *
 * showcase 커버는 실제 고객 알림장의 메인 디자인을 config 렌더로 홈에 노출하기
 * 위한 스냅샷이다. 관리자가 메인 사진 위에 얼굴 스티커를 붙여 익명화한 이미지를
 * heroImage 로 갈아끼운 뒤 저장한다. 저장 시 랜딩('/')을 revalidate.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationContentSchema } from '@/types/invitation';
import {
  getSocialProof,
  saveSocialProof,
  type ShowcaseCover,
} from '@/lib/marketing/social-proof';

/**
 * showcase 대상 알림장의 메인 디자인 소스를 불러온다(admin). content(파싱본) +
 * 이름/날짜 + 현재 heroImage. heroImage 가 없으면 hasPhoto=false 로 알려준다.
 */
export async function loadInvitationForShowcase(invitationId: string): Promise<
  | {
      ok: true;
      content: unknown;
      groomName: string;
      brideName: string;
      weddingDate: string;
      heroImage: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const id = invitationId.trim();
  if (!id) return { ok: false, error: '알림장 ID를 입력해주세요.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select('content, groom_name, bride_name, wedding_date')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: '해당 ID의 알림장을 찾을 수 없습니다.' };

  const parsed = InvitationContentSchema.safeParse(data.content ?? {});
  if (!parsed.success) return { ok: false, error: '알림장 콘텐츠 파싱 실패.' };

  const heroImage =
    typeof parsed.data.main.heroImage === 'string' && parsed.data.main.heroImage
      ? parsed.data.main.heroImage
      : null;

  return {
    ok: true,
    content: parsed.data,
    groomName: data.groom_name ?? '',
    brideName: data.bride_name ?? '',
    weddingDate: data.wedding_date ?? '',
    heroImage,
  };
}

/**
 * 스티커 합성본 업로드(admin) — public-images 의 marketing/showcase/ 경로.
 * 클라이언트에서 canvas 로 합성한 PNG 를 그대로 받는다.
 */
export async function uploadShowcaseImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'no file' };
  if (file.size > 12 * 1024 * 1024)
    return { ok: false, error: 'file too large (>12MB)' };
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { ok: false, error: 'unsupported type' };
  }
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
  const path = `marketing/showcase/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { data } = admin.storage.from('public-images').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** showcase 커버 목록 저장(admin). 사회적 증거 설정의 covers 만 교체. */
export async function saveShowcaseCovers(
  covers: ShowcaseCover[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const config = await getSocialProof();
  const res = await saveSocialProof({ ...config, covers });
  if (!res.ok) return res;
  revalidatePath('/');
  revalidatePath('/admin/showcase');
  return { ok: true };
}
