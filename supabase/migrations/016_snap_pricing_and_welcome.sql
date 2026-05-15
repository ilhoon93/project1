-- ============================================================
-- 016_snap_pricing_and_welcome.sql
--
-- 사용자 결정사항 (PR 시점):
--
-- 1) 신규 가격 ladder + 체험팩 신설
--    snap_5  — 5크레딧 3,900원 (체험팩, 신규)
--    snap_20 — 20크레딧 13,900원 (가격 인하 19,900 → 13,900)
--    snap_40 — 40크레딧 24,900원 (신규)
--    snap_50 / snap_100 단종 (active=false, 히스토리 보존)
--
-- 2) 가입 시 무료 커플 카탈로그 1장 — snap_credits_ledger 에 reason='welcome' 으로
--    +1 적립. 멱등 RPC `grant_welcome_snap_credit(uid)` 가 처음 호출 시에만 적립.
--
-- 3) 앵커 무료 batch 정책 변경 — "크레딧 결제한 사용자에게만" 무료 batch 제공.
--    /api/snap/anchor/generate 가 `has_purchased_snap(uid)` 로 결제 이력을 확인,
--    결제 안 한 사용자는 무료 batch 가 0회 (즉 첫 batch 부터 4 크레딧 필요).
--    결제 사용자는 PR #95 의 free_full_batches_used 카운터로 2회까지 무료 유지.
-- ============================================================

-- ── (1a) 'welcome' reason 추가 — CHECK 제약 갱신 ────────────
-- ALTER TYPE / CHECK 변경. Postgres 12+ 면 ALTER ... ADD CHECK 가능.
alter table public.snap_credits_ledger
  drop constraint if exists snap_credits_ledger_reason_check;
alter table public.snap_credits_ledger
  add constraint snap_credits_ledger_reason_check
  check (reason in (
    'purchase','consume','refund','legacy_migration','admin_grant','admin_revoke','welcome'
  ));

-- ── (1b) 가입 환영 크레딧 멱등 RPC ─────────────────────────────
create or replace function public.grant_welcome_snap_credit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  already_granted boolean;
begin
  -- 이미 받았으면 멱등 — 추가 적립 X.
  select exists (
    select 1 from public.snap_credits_ledger
     where user_id = p_user_id and reason = 'welcome'
  ) into already_granted;

  if already_granted then
    return jsonb_build_object('granted', false, 'reason', 'already_granted');
  end if;

  insert into public.snap_credits_ledger (user_id, delta, reason, note)
  values (p_user_id, 1, 'welcome', '가입 환영 무료 크레딧 (커플 카탈로그 1장)');

  return jsonb_build_object('granted', true, 'delta', 1);
end;
$$;

comment on function public.grant_welcome_snap_credit(uuid) is
  '가입 시 1회만 +1 크레딧 적립 (커플 카탈로그 1장 체험용). 두 번째 호출부터 멱등.';

-- ── (2) 결제 이력 조회 helper — 앵커 무료 batch gating 용 ───
create or replace function public.has_purchased_snap(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.snap_credits_ledger
     where user_id = p_user_id
       and reason = 'purchase'
  );
$$;

comment on function public.has_purchased_snap(uuid) is
  '사용자가 스냅 크레딧을 결제한 적이 있는지. 앵커 무료 batch 자격 판단용.';

-- ── (3) 신규 패키지 + 가격 변경 ─────────────────────────────
-- snap_5 (체험팩, 신규)
insert into public.addon_packages (code, name, description, price, publish_credits_grant, active, sort_order)
values
  ('snap_5',  'AI 웨딩스냅 체험팩', 'AI 웨딩 스냅 5장 생성 크레딧 (체험용)', 3900,  0, true, 20)
on conflict (code) do nothing;

-- snap_40 (헤비, 신규)
insert into public.addon_packages (code, name, description, price, publish_credits_grant, active, sort_order)
values
  ('snap_40', 'AI 웨딩스냅 헤비 패키지', 'AI 웨딩 스냅 40장 생성 크레딧', 24900, 0, true, 22)
on conflict (code) do nothing;

-- snap_20 가격 인하 (19,900 → 13,900). 기존 행 update.
update public.addon_packages
   set price = 13900,
       name = 'AI 웨딩스냅 표준 패키지',
       description = 'AI 웨딩 스냅 20장 생성 크레딧 (가장 인기)',
       sort_order = 21,
       active = true
 where code = 'snap_20';

-- snap_50 / snap_100 단종 — active 만 false 로. 기존 구매자 잔량은 유지.
update public.addon_packages
   set active = false,
       description = coalesce(description, '') || ' (단종 — snap_5 / snap_20 / snap_40 으로 교체)'
 where code in ('snap_50', 'snap_100')
   and active = true;

-- ── (4) grant_purchase_credits — snap_5 / snap_40 분기 추가 ──
-- 기존 snap_20 / snap_50 / snap_100 로직은 유지하고 snap_5, snap_40 만 신규 추가.
create or replace function public.grant_purchase_credits(
  p_user_id          uuid,
  p_source           text,
  p_package_code     text,
  p_amount           integer,
  p_portone_payment  text default null,
  p_naver_order_no   text default null,
  p_naver_product_no text default null,
  p_raw              jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg              record;
  granted_publish  integer := 0;
  granted_archive  integer := 0;
  granted_snap     integer := 0;
  order_id         uuid;
begin
  select * into pkg from public.addon_packages where code = p_package_code;
  if not found then
    raise exception 'Unknown package: %', p_package_code using errcode = 'P0002';
  end if;

  -- (a) idempotency.
  if p_portone_payment is not null then
    select id into order_id from public.purchase_orders
     where portone_payment_id = p_portone_payment;
    if order_id is not null then
      return jsonb_build_object('order_id', order_id, 'idempotent', true, 'granted', 0);
    end if;
  end if;
  if p_naver_order_no is not null then
    select id into order_id from public.purchase_orders
     where source = p_source and naver_product_order_no = p_naver_order_no;
    if order_id is not null then
      return jsonb_build_object('order_id', order_id, 'idempotent', true, 'granted', 0);
    end if;
  end if;

  -- (b) 패키지별 ledger 입금.
  if p_package_code = 'basic' then
    granted_publish := pkg.publish_credits_grant;
    insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_publish, 'purchase', 'purchase_orders', null, p_package_code);
  elsif p_package_code = 'archive_basic' then
    granted_archive := 2;
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_archive, 'purchase', 'purchase_orders', null, p_package_code);
  elsif p_package_code = 'snap_5' then
    granted_snap := 5;
  elsif p_package_code = 'snap_20' then
    granted_snap := 20;
  elsif p_package_code = 'snap_40' then
    granted_snap := 40;
  elsif p_package_code = 'snap_50' then
    granted_snap := 50;
  elsif p_package_code = 'snap_100' then
    granted_snap := 100;
    -- 풀패키지 영구소장 1 보너스 (12번 마이그 정책 유지).
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, 1, 'purchase', 'purchase_orders', null, p_package_code || ' bonus archive');
    granted_archive := 1;
  else
    raise exception 'Unknown package code: %', p_package_code using errcode = 'P0002';
  end if;

  if granted_snap > 0 then
    insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_snap, 'purchase', 'purchase_orders', null, p_package_code);
  end if;

  -- (c) purchase_orders 행 생성.
  insert into public.purchase_orders (
    user_id, source, package_code, amount,
    portone_payment_id, naver_product_order_no, naver_product_no,
    raw, status, completed_at
  ) values (
    p_user_id, p_source, p_package_code, p_amount,
    p_portone_payment, p_naver_order_no, p_naver_product_no,
    p_raw, 'completed', now()
  ) returning id into order_id;

  return jsonb_build_object(
    'order_id', order_id,
    'idempotent', false,
    'granted', granted_snap + granted_publish + granted_archive,
    'granted_publish', granted_publish,
    'granted_archive', granted_archive,
    'granted_snap', granted_snap
  );
end;
$$;
