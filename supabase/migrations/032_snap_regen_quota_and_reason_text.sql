-- 032_snap_regen_quota_and_reason_text.sql
--
-- 마이페이지 재생성 정책 v2 — 패키지별 무료 재생성 quota.
--
-- ── 배경 ──
-- 031 에서 도입된 "결과당 1회 무료" 모델은 무한 무료 폭주 위험 (사용자가 카탈로그
-- 결과 50장 만들면 50회 무료). 결제 패키지 크기에 비례한 quota 로 전환.
--
-- ── 정책 ──
--   snap_5  구매 → +1 회 무료 재생성
--   snap_20 구매 → +4 회 무료 재생성
--   snap_40 구매 → +8 회 무료 재생성
--   snap_50 / snap_100 (단종, 구매분만) → 각각 10 / 20 회
--   대략 결제 크레딧의 20% — 사용자가 결과당 한 번 정도 재생성 시도 가능.
--
-- 사용자가 마이페이지에서 재생성 누를 때:
--   free_regen_remaining > 0 → 1 회 차감, generate API 의 1 크레딧 차감을 refund
--   free_regen_remaining = 0 → 1 크레딧 그대로 차감 (refund 없음)
--
-- 031 의 `regen_used_free` per-job flag 는 더 이상 의미 없음 (남겨두되 사용 X).
--
-- ── 신규 컬럼 ──
--   snap_jobs.regen_reason_text : 'other' 이유 선택 시 사용자가 직접 입력한 텍스트
-- ──────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- 1. snap_user_quota 테이블 — 사용자별 무료 재생성 잔량 counter
-- ═════════════════════════════════════════════════════════════

create table if not exists public.snap_user_quota (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  free_regen_remaining integer not null default 0 check (free_regen_remaining >= 0),
  total_granted        integer not null default 0,
  updated_at           timestamptz not null default now()
);

comment on table public.snap_user_quota is
  '사용자별 무료 재생성 잔량. 패키지 구매 시 grant_purchase_credits 가 증가시키고
   /api/snap/jobs/[id]/regenerate 가 consume_free_regen RPC 로 차감.';
comment on column public.snap_user_quota.free_regen_remaining is
  '아직 사용 가능한 무료 재생성 횟수. 0 이면 재생성은 1 크레딧 차감.';
comment on column public.snap_user_quota.total_granted is
  '지금까지 누적 적립된 무료 재생성 총량 (디버깅/통계용, 실제 사용량은 granted - remaining).';

-- RLS — 본인 잔량만 읽기. 쓰기는 service role (RPC) 만.
alter table public.snap_user_quota enable row level security;

drop policy if exists snap_user_quota_select_self on public.snap_user_quota;
create policy snap_user_quota_select_self on public.snap_user_quota
  for select using (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════
-- 2. consume_free_regen RPC — 잔량 차감
-- ═════════════════════════════════════════════════════════════

create or replace function public.consume_free_regen(
  p_user_id uuid,
  p_amount  integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_remaining integer;
begin
  -- row 가 없으면 0 으로 간주하고 실패.
  select free_regen_remaining into cur_remaining
    from public.snap_user_quota
   where user_id = p_user_id
   for update;

  if cur_remaining is null then
    return jsonb_build_object('consumed', false, 'remaining', 0, 'reason', 'no_quota');
  end if;
  if cur_remaining < p_amount then
    return jsonb_build_object('consumed', false, 'remaining', cur_remaining, 'reason', 'insufficient');
  end if;

  update public.snap_user_quota
     set free_regen_remaining = free_regen_remaining - p_amount,
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object('consumed', true, 'remaining', cur_remaining - p_amount);
end;
$$;

comment on function public.consume_free_regen(uuid, integer) is
  '사용자의 무료 재생성 잔량에서 amount 만큼 차감. 부족하면 consumed=false 반환
   (호출자가 크레딧 차감으로 fallback). row-level lock 으로 동시성 안전.';

-- ═════════════════════════════════════════════════════════════
-- 3. grant_purchase_credits — 패키지별 무료 재생성 quota 추가
-- ═════════════════════════════════════════════════════════════

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
  granted_regen    integer := 0;
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

  -- (b) 패키지별 ledger 입금 + 무료 재생성 quota.
  if p_package_code = 'basic' then
    granted_publish := pkg.publish_credits_grant;
    insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_publish, 'purchase', 'purchase_orders', null, p_package_code);
  elsif p_package_code = 'archive_basic' then
    granted_archive := 2;
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_archive, 'purchase', 'purchase_orders', null, p_package_code);
  elsif p_package_code = 'snap_5' then
    granted_snap  := 5;
    granted_regen := 1;
  elsif p_package_code = 'snap_20' then
    granted_snap  := 20;
    granted_regen := 4;
  elsif p_package_code = 'snap_40' then
    granted_snap  := 40;
    granted_regen := 8;
  elsif p_package_code = 'snap_50' then
    granted_snap  := 50;
    granted_regen := 10;
  elsif p_package_code = 'snap_100' then
    granted_snap  := 100;
    granted_regen := 20;
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

  -- 무료 재생성 quota — upsert.
  if granted_regen > 0 then
    insert into public.snap_user_quota (user_id, free_regen_remaining, total_granted, updated_at)
    values (p_user_id, granted_regen, granted_regen, now())
    on conflict (user_id) do update
      set free_regen_remaining = public.snap_user_quota.free_regen_remaining + excluded.free_regen_remaining,
          total_granted        = public.snap_user_quota.total_granted        + excluded.total_granted,
          updated_at           = now();
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
    'granted_snap', granted_snap,
    'granted_regen', granted_regen
  );
end;
$$;

-- ═════════════════════════════════════════════════════════════
-- 4. 기존 구매자 backfill — 과거 snap_* 결제 합산해서 quota 적립
-- ═════════════════════════════════════════════════════════════
-- purchase_orders 의 완료된 snap_* 패키지를 모두 합산해 user 별 누적 quota 부여.
-- 이미 snap_user_quota 행이 있으면 (이번 마이그 재실행 등) skip.

insert into public.snap_user_quota (user_id, free_regen_remaining, total_granted, updated_at)
select
  user_id,
  sum(case package_code
        when 'snap_5'   then 1
        when 'snap_20'  then 4
        when 'snap_40'  then 8
        when 'snap_50'  then 10
        when 'snap_100' then 20
        else 0
      end) as total_quota,
  sum(case package_code
        when 'snap_5'   then 1
        when 'snap_20'  then 4
        when 'snap_40'  then 8
        when 'snap_50'  then 10
        when 'snap_100' then 20
        else 0
      end) as total_granted,
  now()
from public.purchase_orders
where status = 'completed'
  and package_code in ('snap_5', 'snap_20', 'snap_40', 'snap_50', 'snap_100')
group by user_id
on conflict (user_id) do nothing;

-- ═════════════════════════════════════════════════════════════
-- 5. snap_jobs.regen_reason_text — 'other' 이유 자유 텍스트
-- ═════════════════════════════════════════════════════════════

alter table public.snap_jobs
  add column if not exists regen_reason_text text;

comment on column public.snap_jobs.regen_reason_text is
  'regen_reason = ''other'' 일 때 사용자가 직접 입력한 자유 텍스트 (최대 500자
   클라이언트에서 trim). 다른 reason 값에서는 null. admin 통계에서 미정의 불만
   유형 발견에 사용.';
