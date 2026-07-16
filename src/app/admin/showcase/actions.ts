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
import { nanoid } from '@/lib/utils/nanoid';
import {
  InvitationContentSchema,
  type InvitationContent,
} from '@/types/invitation';
import {
  getSocialProof,
  saveSocialProof,
  type ShowcaseCover,
} from '@/lib/marketing/social-proof';

export interface ShowcaseCandidate {
  id: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  heroImage: string;
  /** 실제 사진이 노출되는 디자인인지(포스터/액자 + heroImage). false 면 일러스트·텍스트 등 사진 없는 디자인. */
  hasPhoto: boolean;
}

// 실제 업로드 사진이 표지에 노출되는 레이아웃.
const PHOTO_LAYOUTS = new Set(['poster', 'frame', 'polaroid']);

/** content 가 실제 사진(얼굴)을 노출하는 디자인인지. */
function designHasPhoto(content: InvitationContent): boolean {
  const hero = content.main.heroImage;
  return (
    typeof hero === 'string' && !!hero && PHOTO_LAYOUTS.has(content.main.layout)
  );
}

/** 이름 익명화 — 첫 글자 + ○ (예: 민준 → 민○). 비면 ○○. */
function initialName(name: string | null): string {
  const t = (name ?? '').trim();
  return t ? `${t[0]}○` : '○○';
}

/**
 * showcase 후보 목록(admin).
 *   - 사진 있는 디자인: 홈 노출 동의(showcase_consent)한 발행 건만.
 *   - 사진 없는 디자인(일러스트·텍스트 등): 얼굴 노출이 없어 동의 없이도 후보로 포함.
 */
export async function listShowcaseCandidates(): Promise<
  { ok: true; candidates: ShowcaseCandidate[] } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const admin = createAdminClient();

  // 동의는 계정 단위 — 포토리뷰 이벤트에 참여(동의)한 계정은 동의 시점 이후에
  // 발행한 알림장도 모두 동의로 간주한다. (예전 per-invitation showcase_consent
  // 플래그는 동의 시점의 발행 건에만 찍혀 이후 발행 건이 누락되던 문제 해결.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (admin as any)
    .from('review_event_submissions')
    .select('user_id');
  const consentedUsers = new Set<string>(
    ((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id),
  );

  // showcase_consent 는 자동생성 DB 타입(063 미반영)에 아직 없어 any 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = admin.from('invitations') as any;
  const { data, error } = await q
    .select('id, user_id, groom_name, bride_name, wedding_date, content, showcase_consent')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) return { ok: false, error: error.message };

  const candidates: ShowcaseCandidate[] = [];
  for (const row of (data ?? []) as Array<{
    id: string;
    user_id: string;
    groom_name: string | null;
    bride_name: string | null;
    wedding_date: string | null;
    content: unknown;
    showcase_consent: boolean | null;
  }>) {
    const parsed = InvitationContentSchema.safeParse(row.content ?? {});
    if (!parsed.success) continue;
    const hasPhoto = designHasPhoto(parsed.data);
    // 사진 있는 디자인은 동의 필수(계정 참여 or 레거시 플래그), 사진 없는 디자인은 동의 불필요.
    const ownerConsented = consentedUsers.has(row.user_id) || !!row.showcase_consent;
    if (hasPhoto && !ownerConsented) continue;
    candidates.push({
      id: row.id,
      groomName: row.groom_name ?? '',
      brideName: row.bride_name ?? '',
      weddingDate: row.wedding_date ?? '',
      heroImage: hasPhoto ? (parsed.data.main.heroImage as string) : '',
      hasPhoto,
    });
  }
  return { ok: true, candidates };
}

/** content 로 사진 없는 커버 스냅샷을 만든다(이름 익명화). */
function buildPhotolessCover(
  invitationId: string,
  content: InvitationContent,
  groomName: string | null,
  brideName: string | null,
  weddingDate: string | null,
): ShowcaseCover {
  return {
    id: nanoid(10),
    invitationId,
    groomName: initialName(groomName),
    brideName: initialName(brideName),
    weddingDate: weddingDate ?? '',
    hidden: false,
    content,
  };
}

/**
 * 사진 없는 디자인 1건을 커버로 바로 추가(스티커 불필요). 같은 알림장은 교체.
 */
export async function addPhotolessCover(
  invitationId: string,
): Promise<{ ok: true; covers: ShowcaseCover[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select('content, groom_name, bride_name, wedding_date')
    .eq('id', invitationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: '알림장을 찾을 수 없습니다.' };
  const parsed = InvitationContentSchema.safeParse(data.content ?? {});
  if (!parsed.success) return { ok: false, error: '콘텐츠 파싱 실패.' };
  if (designHasPhoto(parsed.data))
    return { ok: false, error: '사진 있는 디자인은 스티커 설정이 필요합니다.' };

  const config = await getSocialProof();
  const cover = buildPhotolessCover(
    invitationId,
    parsed.data,
    data.groom_name,
    data.bride_name,
    data.wedding_date,
  );
  const covers = [
    ...config.covers.filter((c) => c.invitationId !== invitationId),
    cover,
  ];
  const res = await saveSocialProof({ ...config, covers });
  if (!res.ok) return { ok: false, error: res.error ?? 'save failed' };
  revalidatePath('/');
  revalidatePath('/admin/showcase');
  return { ok: true, covers };
}

/**
 * 사진 없는 디자인(일러스트·텍스트 등) 발행 건을 한 번에 모두 커버로 추가.
 * 이미 등록된 알림장은 건너뛴다(동의 불필요).
 */
export async function addAllPhotolessCovers(): Promise<
  { ok: true; covers: ShowcaseCover[]; added: number } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('invitations')
    .select('id, groom_name, bride_name, wedding_date, content')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) return { ok: false, error: error.message };

  const config = await getSocialProof();
  const existing = new Set(config.covers.map((c) => c.invitationId).filter(Boolean));
  const additions: ShowcaseCover[] = [];
  for (const row of (data ?? []) as Array<{
    id: string;
    groom_name: string | null;
    bride_name: string | null;
    wedding_date: string | null;
    content: unknown;
  }>) {
    if (existing.has(row.id)) continue;
    const parsed = InvitationContentSchema.safeParse(row.content ?? {});
    if (!parsed.success) continue;
    if (designHasPhoto(parsed.data)) continue; // 사진 있는 건 제외
    additions.push(
      buildPhotolessCover(
        row.id,
        parsed.data,
        row.groom_name,
        row.bride_name,
        row.wedding_date,
      ),
    );
  }
  if (additions.length === 0)
    return { ok: true, covers: config.covers, added: 0 };

  const covers = [...config.covers, ...additions];
  const res = await saveSocialProof({ ...config, covers });
  if (!res.ok) return { ok: false, error: res.error ?? 'save failed' };
  revalidatePath('/');
  revalidatePath('/admin/showcase');
  return { ok: true, covers, added: additions.length };
}

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
