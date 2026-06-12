-- 048_admin_invitations_order_by_updated.sql
--
-- admin_invitations 목록 정렬을 생성일(created_at)순 → 최종 수정일시
-- (updated_at)순으로 변경. 운영자가 "최근에 편집된 알림장"을 먼저 보도록 한다.
-- 시그니처/반환 컬럼은 047 과 동일 — create or replace 로 본문(정렬)만 교체.

-- 최종 수정일시 정렬용 인덱스.
create index if not exists idx_invitations_updated
  on public.invitations (updated_at desc);

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
  order by i.updated_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

revoke execute on function public.admin_invitations(text, boolean, integer, integer) from anon, authenticated;

comment on function public.admin_invitations(text, boolean, integer, integer) is
  '운영자용 알림장 목록 조회. 최종 수정일시(updated_at) 내림차순, 생성자 이메일 필터, 발행된 것만 보기 옵션, limit/offset 페이지네이션. service_role 전용.';
