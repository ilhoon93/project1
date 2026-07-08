'use server';

/**
 * /admin/social-proof server actions — admin role 만 통과.
 *
 * 저장은 랜딩에 아직 연결하지 않았으므로 revalidate 대상은 admin 페이지뿐.
 * (메인 렌더 연결 시 revalidatePath('/') 추가 예정.)
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveSocialProof, type SocialProofConfig } from '@/lib/marketing/social-proof';

export async function saveSocialProofAction(
  config: SocialProofConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const res = await saveSocialProof(config);
  if (!res.ok) return res;
  revalidatePath('/admin/social-proof');
  return { ok: true };
}

/**
 * 리뷰 이미지 업로드 — admin 만 통과. `public-images` 버킷의
 * `marketing/social-proof/<ts>.<ext>` 경로에 저장 후 public URL 반환.
 * image/jpeg|png|webp 만 허용 (8MB 제한). (home-samples 업로드와 동일 패턴)
 */
export async function uploadReviewImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'no file' };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'file too large (>8MB)' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, error: 'unsupported type' };
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `marketing/social-proof/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { data } = admin.storage.from('public-images').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
