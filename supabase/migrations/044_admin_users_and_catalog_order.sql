-- ============================================================
-- 044_admin_users_and_catalog_order.sql
--
-- 운영자 기능 2종 백엔드:
--   1) admin_user_overview()      — 가입자 목록 + 크레딧/결제 현황 집계
--   2) admin_adjust_credits(...)  — 운영자 수동 크레딧 가감 (발행권/영구소장/스냅)
--   3) snap_catalog_order         — 카탈로그 노출 순서(운영자 지정) 테이블
--
-- 1·2 는 security definer + service_role 전용(서버 액션이 requireAdmin 후 호출).
-- 3 은 28번 snap_catalog_tags 와 동일한 RLS 패턴(읽기 공개, 쓰기 admin).
-- ============================================================

-- ── 1) 가입자 개요 집계 ─────────────────────────────────────
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
    u.email,
    u.created_at,
    coalesce((select sum(delta) from public.publish_credits_ledger l where l.user_id = u.id), 0)::int,
    coalesce((select sum(delta) from public.archive_credits_ledger l where l.user_id = u.id), 0)::int,
    coalesce((select sum(delta) from public.snap_credits_ledger    l where l.user_id = u.id), 0)::int,
    coalesce((select count(*)   from public.purchase_orders o where o.user_id = u.id), 0)::int,
    coalesce((select sum(amount) from public.purchase_orders o where o.user_id = u.id), 0)::int
  from auth.users u
  order by u.created_at desc;
$$;

revoke execute on function public.admin_user_overview() from anon, authenticated;

comment on function public.admin_user_overview() is
  '운영자용 가입자 목록 + 크레딧(발행권/영구소장/스냅) 잔액 + 결제 건수/총액 집계. service_role 전용.';

-- ── 2) 운영자 크레딧 가감 ───────────────────────────────────
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_kind    text,     -- 'publish' | 'archive' | 'snap'
  p_delta   integer,  -- 양수=지급(admin_grant), 음수=회수(admin_revoke)
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason  text;
  v_balance integer;
  v_note    text;
begin
  if p_delta = 0 then
    raise exception 'delta must be non-zero';
  end if;
  v_reason := case when p_delta > 0 then 'admin_grant' else 'admin_revoke' end;
  v_note   := coalesce(nullif(trim(p_note), ''), 'admin adjust');

  if p_kind = 'publish' then
    insert into public.publish_credits_ledger (user_id, delta, reason, note)
    values (p_user_id, p_delta, v_reason, v_note);
    select coalesce(sum(delta), 0) into v_balance
      from public.publish_credits_ledger where user_id = p_user_id;
  elsif p_kind = 'archive' then
    insert into public.archive_credits_ledger (user_id, delta, reason, note)
    values (p_user_id, p_delta, v_reason, v_note);
    select coalesce(sum(delta), 0) into v_balance
      from public.archive_credits_ledger where user_id = p_user_id;
  elsif p_kind = 'snap' then
    insert into public.snap_credits_ledger (user_id, delta, reason, note)
    values (p_user_id, p_delta, v_reason, v_note);
    select coalesce(sum(delta), 0) into v_balance
      from public.snap_credits_ledger where user_id = p_user_id;
  else
    raise exception 'invalid kind: %', p_kind;
  end if;

  -- 잔액이 음수가 되지 않도록 가드 (회수 시 과회수 방지).
  if v_balance < 0 then
    raise exception 'resulting balance would be negative (%).', v_balance;
  end if;

  return jsonb_build_object('kind', p_kind, 'delta', p_delta, 'balance', v_balance);
end;
$$;

revoke execute on function public.admin_adjust_credits(uuid, text, integer, text) from anon, authenticated;

comment on function public.admin_adjust_credits(uuid, text, integer, text) is
  '운영자 수동 크레딧 가감. kind=publish/archive/snap, delta 양수=지급/음수=회수. 음수 잔액 방지. service_role 전용.';

-- ── 3) 카탈로그 노출 순서 ───────────────────────────────────
create table if not exists public.snap_catalog_order (
  catalog_id text primary key,
  sort_order integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.snap_catalog_order is
  '카탈로그 노출 순서(운영자 지정). catalog_id = SNAP_CATALOG[].id. sort_order 오름차순 우선, 미지정은 코드 순서 뒤.';

create or replace function public.snap_catalog_order_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists snap_catalog_order_touch_updated_at on public.snap_catalog_order;
create trigger snap_catalog_order_touch_updated_at
  before update on public.snap_catalog_order
  for each row execute function public.snap_catalog_order_touch_updated_at();

alter table public.snap_catalog_order enable row level security;

-- 읽기: 누구나 (랜딩/카탈로그 페이지가 anon 으로도 렌더되므로 공개).
drop policy if exists snap_catalog_order_select_all on public.snap_catalog_order;
create policy snap_catalog_order_select_all
  on public.snap_catalog_order
  for select
  using (true);

-- 쓰기: admin role 만.
drop policy if exists snap_catalog_order_modify_admin on public.snap_catalog_order;
create policy snap_catalog_order_modify_admin
  on public.snap_catalog_order
  for all
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');
