-- ============================================================
-- 045_admin_user_overview_naver_only.sql
--
-- 운영자 가입자 목록을 "네이버 연동 + 실제 이메일" 사용자만 보이도록 정정.
--
-- 배경:
--   admin_user_overview 가 auth.users 전체를 돌려줘서
--     1) 이메일 동의 거부/누락 시 쓰는 임시 가짜 이메일
--        (naver_<id>@users.minimum-wedding.local) 형태와
--     2) 예전에 카카오로 가입한(=naver_accounts 행이 없는) 계정
--   까지 노출됐다.
--
-- 정정:
--   - naver_accounts 와 inner join → 네이버 연동 계정만 (카카오 등 제외).
--   - 표시 이메일은 naver_accounts.email 우선, 가짜 도메인은 제외.
--
-- 반환 컬럼/타입은 044 와 동일 → create or replace 로 본문만 교체.
-- ============================================================
create or replace function public.admin_user_overview()
returns table (
  user_id         uuid,
  email           text,
  created_at      timestamptz,
  publish_balance integer,
  archive_balance integer,
  snap_balance    integer,
  order_count     integer,
  order_amount    integer
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    coalesce(na.email, u.email),
    u.created_at,
    coalesce((select sum(delta) from public.publish_credits_ledger l where l.user_id = u.id), 0)::int,
    coalesce((select sum(delta) from public.archive_credits_ledger l where l.user_id = u.id), 0)::int,
    coalesce((select sum(delta) from public.snap_credits_ledger    l where l.user_id = u.id), 0)::int,
    coalesce((select count(*)   from public.purchase_orders o where o.user_id = u.id), 0)::int,
    coalesce((select sum(amount) from public.purchase_orders o where o.user_id = u.id), 0)::int
  from auth.users u
  join public.naver_accounts na on na.user_id = u.id
  where coalesce(na.email, u.email) not like '%@users.minimum-wedding.local'
  order by u.created_at desc;
$$;

revoke execute on function public.admin_user_overview() from anon, authenticated;
