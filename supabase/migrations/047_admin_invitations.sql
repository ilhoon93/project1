-- 047_admin_invitations.sql
--
-- 운영자용 알림장 목록 조회 RPC.
--
-- 목적: /admin/invitations 페이지에서 알림장을 최신순(created_at desc)으로
--       페이지네이션하며 조회하고, 생성자 이메일(naver/auth)로 필터, 발행된
--       것만 보기 옵션을 제공한다.
--
-- 이메일 해석은 045/046 와 동일: naver_accounts.email 우선, 없으면 auth.users.email.
-- security definer + service_role 전용(revoke). p_limit 은 앱에서 PAGE_SIZE+1 로
-- 호출해 다음 페이지 존재 여부를 판단한다.

-- 전역 최신순 정렬용 인덱스 (기존엔 user/slug/expires 인덱스만 존재).
create index if not exists idx_invitations_created
  on public.invitations (created_at desc);

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
  updated_at    timestamptz
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
    i.updated_at
  from public.invitations i
  join auth.users u on u.id = i.user_id
  left join public.naver_accounts na on na.user_id = i.user_id
  where (
      p_email is null
      or btrim(p_email) = ''
      or coalesce(na.email, u.email) ilike '%' || btrim(p_email) || '%'
    )
    and (not p_published_only or i.is_published = true)
  order by i.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

revoke execute on function public.admin_invitations(text, boolean, integer, integer) from anon, authenticated;

comment on function public.admin_invitations(text, boolean, integer, integer) is
  '운영자용 알림장 목록 조회. 최신순, 생성자 이메일 필터, 발행된 것만 보기 옵션, limit/offset 페이지네이션. service_role 전용.';
