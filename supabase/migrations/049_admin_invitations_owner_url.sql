-- 049_admin_invitations_owner_url.sql
--
-- admin_invitations 가 활성 publication 의 slug·owner_token·archived 를 함께
-- 반환하도록 확장. 발행 시 publication 은 invitations.slug 와 다른 새 slug +
-- owner_token 을 발급하므로, 운영자 목록에서 실제 하객용/소장용 URL 을 정확히
-- 보여주려면 publication 정보를 조인해야 한다.
--   하객용 : /{pub_slug}
--   소장용 : /{pub_slug}/o/{owner_token}
--
-- 반환 컬럼이 늘어 시그니처가 바뀌므로 drop 후 재생성. 정렬/필터/권한은 048 과 동일.

drop function if exists public.admin_invitations(text, boolean, integer, integer);

create or replace function public.admin_invitations(
  p_email          text default null,
  p_published_only boolean default false,
  p_limit          integer default 31,
  p_offset         integer default 0
)
returns table (
  id            uuid,
  user_id       uuid,
  email         text,
  slug          text,
  groom_name    text,
  bride_name    text,
  wedding_date  date,
  is_published  boolean,
  published_at  timestamptz,
  expires_at    timestamptz,
  paid_at       timestamptz,
  total_price   integer,
  created_at    timestamptz,
  updated_at    timestamptz,
  pub_slug      text,
  owner_token   text,
  archived      boolean
)
language sql
security definer
set search_path = public
as $$
  select
    i.id,
    i.user_id,
    coalesce(na.email, u.email) as email,
    i.slug,
    i.groom_name,
    i.bride_name,
    i.wedding_date,
    i.is_published,
    i.published_at,
    i.expires_at,
    i.paid_at,
    i.total_price,
    i.created_at,
    i.updated_at,
    pub.slug as pub_slug,
    pub.owner_token,
    pub.archived
  from public.invitations i
  join auth.users u on u.id = i.user_id
  left join public.naver_accounts na on na.user_id = i.user_id
  -- 활성(미취소) publication 중 가장 최근 1건.
  left join lateral (
    select p.slug, p.owner_token, p.archived
    from public.publications p
    where p.invitation_id = i.id
      and p.revoked_at is null
    order by p.published_at desc
    limit 1
  ) pub on true
  where (
      p_email is null
      or btrim(p_email) = ''
      or coalesce(na.email, u.email) ilike '%' || btrim(p_email) || '%'
    )
    and (not p_published_only or i.is_published = true)
  order by i.updated_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

revoke execute on function public.admin_invitations(text, boolean, integer, integer) from anon, authenticated;

comment on function public.admin_invitations(text, boolean, integer, integer) is
  '운영자용 알림장 목록. 최종 수정일시순, 이메일 필터, 발행만 보기, 활성 publication 의 slug/owner_token/archived(하객용·소장용 URL) 포함. service_role 전용.';
