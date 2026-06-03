'use server';

/**
 * /admin/home-samples server action — admin role 만 통과.
 * 저장 후 랜딩(/, /designs)과 admin 페이지를 revalidate 해 즉시 반영.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveHomeSamples } from '@/lib/marketing/home-samples';
import type { HomeSamplesConfig } from '@/lib/marketing/sample-invitations';

export async function saveHomeSamplesAction(
  config: HomeSamplesConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const res = await saveHomeSamples(config);
  if (!res.ok) return res;
  revalidatePath('/');
  revalidatePath('/designs');
  revalidatePath('/admin/home-samples');
  return { ok: true };
}

/**
 * Before/After 의 After 사진 업로드 — admin 만 통과. `public-images` 버킷의
 * `marketing/before-after/<styleId>-<ts>.<ext>` 경로에 저장 후 public URL 반환.
 * 파일 확장자는 image/jpeg|png|webp 만 허용 (8MB 제한).
 */
export async function uploadBeforeAfterAfterImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const file = formData.get('file');
  const styleId = (formData.get('styleId') as string | null) ?? 'style';
  if (!(file instanceof File)) return { ok: false, error: 'no file' };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'file too large (>8MB)' };
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, error: 'unsupported type' };
  }
  const safeId = styleId.replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'style';
  const path = `marketing/before-after/${safeId}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { data } = admin.storage.from('public-images').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/**
 * AI 스냅 예시보기 팝업의 예시 이미지 업로드 — admin 만 통과. `public-images` 버킷의
 * `marketing/example-flow/<slot>-<ts>.<ext>` 경로에 저장 후 public URL 반환.
 * image/jpeg|png|webp 만 허용 (8MB 제한).
 */
export async function uploadExampleFlowImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const file = formData.get('file');
  const slot = (formData.get('slot') as string | null) ?? 'slot';
  if (!(file instanceof File)) return { ok: false, error: 'no file' };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'file too large (>8MB)' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, error: 'unsupported type' };
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const safeSlot = slot.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'slot';
  const path = `marketing/example-flow/${safeSlot}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('public-images')
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { data } = admin.storage.from('public-images').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
