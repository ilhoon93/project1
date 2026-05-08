-- ============================================================
-- 007_owner_view_and_engagement.sql
--
--   * publications.owner_token — 신랑신부 전용 "소장용" URL 의 별도 태그
--   * publish_invitation_v2 → publish_invitation_v3 (owner_token 까지 함께 반환)
--   * invitation_cheers — 메인 슬라이드 "축하하기" 누적 카운트
--   * gallery_likes — 갤러리 사진별 좋아요 누적 카운트
--   * bump_cheers / bump_gallery_like — 익명 하객도 호출할 수 있는 RPC
-- ============================================================

-- ── owner_token 컬럼 추가 ────────────────────────────────
alter table public.publications
  add column if not exists owner_token text;

-- 기존 row 에는 backfill (랜덤 16자 hex). pgcrypto 의 gen_random_bytes 사용.
update public.publications
   set owner_token = encode(gen_random_bytes(8), 'hex')
 where owner_token is null;

alter table public.publications
  alter column owner_token set not null;

create unique index if not exists idx_publications_owner_token
  on public.publications (owner_token);

-- ── publish_invitation_v3 — 새 슬러그 + owner_token 동시 발급 ───
create or replace function public.publish_invitation_v3(
  inv_id        uuid,
  new_slug      text,
  new_owner_tok text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv          record;
  caller       uuid := auth.uid();
  balance      integer;
  ledger_id    uuid;
  pub_id       uuid;
  expires      timestamptz;
begin
  if caller is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select *
    into inv
    from public.invitations
   where id = inv_id and user_id = caller
   for update;

  if not found then
    raise exception 'Not found or unauthorized' using errcode = 'P0002';
  end if;

  select coalesce(sum(delta), 0)::integer
    into balance
    from public.publish_credits_ledger
   where user_id = caller;

  if balance < 1 then
    raise exception 'Insufficient publish credits (balance=%)' , balance using errcode = 'P0001';
  end if;

  expires := now() + interval '30 days';

  insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'publish', 'invitations', inv_id, 'publish_invitation_v3')
  returning id into ledger_id;

  insert into public.publications (
    invitation_id, user_id, slug,
    groom_name, bride_name, wedding_date,
    content, expires_at, credit_ledger_id, owner_token
  ) values (
    inv_id, caller, new_slug,
    inv.groom_name, inv.bride_name, inv.wedding_date,
    inv.content, expires, ledger_id, new_owner_tok
  )
  returning id into pub_id;

  update public.invitations
     set is_published = true,
         published_at = coalesce(published_at, now()),
         expires_at   = expires,
         updated_at   = now()
   where id = inv_id;

  return jsonb_build_object(
    'publication_id', pub_id,
    'slug',           new_slug,
    'owner_token',    new_owner_tok,
    'expires_at',     expires
  );
end;
$$;

-- ── invitation_cheers — 축하하기 카운트 ─────────────────────
create table if not exists public.invitation_cheers (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  cheers_count  integer not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.invitation_cheers enable row level security;
-- 읽기는 자유 (owner view 에서도 필요, 하객 페이지에서 보여줘도 무방).
drop policy if exists "cheers select all" on public.invitation_cheers;
create policy "cheers select all"
  on public.invitation_cheers for select using (true);

-- ── gallery_likes — 사진별 좋아요 카운트 ─────────────────────
create table if not exists public.gallery_likes (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  image_index   integer not null check (image_index >= 0 and image_index < 50),
  like_count    integer not null default 0,
  primary key (invitation_id, image_index)
);

alter table public.gallery_likes enable row level security;
drop policy if exists "likes select all" on public.gallery_likes;
create policy "likes select all"
  on public.gallery_likes for select using (true);

-- ── 카운트 증가 RPC (security definer 로 anon 도 호출 가능) ─────
create or replace function public.bump_cheers(inv_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into invitation_cheers (invitation_id, cheers_count, updated_at)
  values (inv_id, 1, now())
  on conflict (invitation_id) do update
    set cheers_count = invitation_cheers.cheers_count + 1,
        updated_at   = now()
  returning cheers_count;
$$;

create or replace function public.bump_gallery_like(inv_id uuid, img_idx integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into gallery_likes (invitation_id, image_index, like_count)
  values (inv_id, img_idx, 1)
  on conflict (invitation_id, image_index) do update
    set like_count = gallery_likes.like_count + 1
  returning like_count;
$$;

grant execute on function public.bump_cheers(uuid) to anon, authenticated;
grant execute on function public.bump_gallery_like(uuid, integer) to anon, authenticated;
