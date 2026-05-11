-- ============================================================
-- 012_snap_credits_and_anchors.sql
--
-- AI 웨딩스냅 패키지를 entitlement(영구 unlock) 모델에서 크레딧 모델로 전환.
--
-- 신규 객체:
--   * public.snap_credits_ledger       — 크레딧 입출금 원장 (publish_credits_ledger 와 동일 패턴)
--   * public.snap_credits_balance(uid) — 잔액 헬퍼 RPC
--   * public.snap_anchors              — 사용자별 1개 앵커 이미지 (얼굴/체형 일관성 anchor)
--   * addon_packages: snap_20 / snap_50 / snap_100 (₩19,900 / ₩39,900 / ₩69,900)
--
-- 변경:
--   * grant_purchase_credits — snap_* 패키지에 대해 snap_credits_ledger 입금 분기
--   * 기존 'ai_snap' 패키지는 비활성화하되 레코드는 유지 (히스토리 보존)
--   * 기존 ai_snap 구매자에게 +20 snap 크레딧 일괄 backfill (PR 결정사항)
-- ============================================================

-- ── snap_credits_ledger ────────────────────────────────────
create table if not exists public.snap_credits_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null,
  -- 'purchase'        구매로 적립
  -- 'consume'         스냅 1장 생성 시 -1
  -- 'refund'          생성 실패 보전
  -- 'legacy_migration' 기존 ai_snap → 20 일괄 적립
  -- 'admin_grant' / 'admin_revoke' 운영용
  reason      text not null check (reason in (
    'purchase','consume','refund','legacy_migration','admin_grant','admin_revoke'
  )),
  ref_table   text,
  ref_id      uuid,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_snap_credits_user
  on public.snap_credits_ledger (user_id);

alter table public.snap_credits_ledger enable row level security;

drop policy if exists "snap_ledger select self" on public.snap_credits_ledger;
create policy "snap_ledger select self"
  on public.snap_credits_ledger for select
  using (auth.uid() = user_id);
-- 입금/차감은 모두 service-role (API route) 에서만 수행. INSERT 정책 없음.

create or replace function public.snap_credits_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.snap_credits_ledger
  where user_id = uid;
$$;

-- ── snap_anchors ───────────────────────────────────────────
-- 사용자당 1개 앵커 (user_id PK).
--   * image_url = NULL : 앵커 후보 batch 만 생성하고 아직 선택을 안 함
--                        (== 무료 활성화를 이미 소비함)
--   * image_url 채워짐 : 사용자가 한 장을 선택해 저장한 상태
-- 새 앵커를 만들려면 같은 행을 update.
create table if not exists public.snap_anchors (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  -- 공개 URL — public-images 버킷의 영구 호스팅 결과. 후보 batch 만 만들고 아직
  -- 선택을 안 했으면 NULL.
  image_url         text,
  -- 어느 모드로 생성됐는지 (selfies / couple). 분석 / 디버깅 용.
  source_mode       text not null check (source_mode in ('selfies','couple')),
  -- 앵커 생성 시 같이 잠긴 체형 가이드 — 카탈로그 생성 시 재사용.
  groom_height_cm   integer,
  groom_weight_kg   integer,
  bride_height_cm   integer,
  bride_weight_kg   integer,
  -- 마지막 batch (4장 후보) 가 생성된 시각. 무료 활성화 소비 여부 판별용.
  last_batch_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.snap_anchors enable row level security;

drop policy if exists "snap_anchors select self" on public.snap_anchors;
create policy "snap_anchors select self"
  on public.snap_anchors for select
  using (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE 는 service-role 에서만.

create or replace function public.touch_snap_anchor_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_snap_anchors_touch on public.snap_anchors;
create trigger trg_snap_anchors_touch
  before update on public.snap_anchors
  for each row execute function public.touch_snap_anchor_updated_at();

-- ── addon_packages — 신규 크레딧 패키지 + 기존 ai_snap 비활성화 ─────
-- 가격: ₩19,900 / ₩39,900 / ₩69,900 (사용자 결정사항)
-- publish_credits_grant 컬럼은 발행권 용도라 0 유지 — 스냅 크레딧은 별도
-- ledger 로 적립한다 (grant_purchase_credits 분기 참조).
insert into public.addon_packages (code, name, description, price, publish_credits_grant, active, sort_order)
values
  ('snap_20',  'AI 웨딩스냅 스타터 패키지', 'AI 웨딩 스냅 20장 생성 크레딧', 19900, 0, true, 21),
  ('snap_50',  'AI 웨딩스냅 베스트 패키지', 'AI 웨딩 스냅 50장 생성 크레딧 — 카탈로그 풀 활용', 39900, 0, true, 22),
  ('snap_100', 'AI 웨딩스냅 풀패키지',     'AI 웨딩 스냅 100장 생성 크레딧 + 영구소장 1개 포함', 69900, 0, true, 23)
on conflict (code) do nothing;

-- 기존 entitlement-스타일 ai_snap 패키지는 더 이상 판매하지 않음 (히스토리는 유지).
update public.addon_packages
   set active = false,
       description = description || ' (단종 — snap_20/50/100 으로 교체됨)'
 where code = 'ai_snap'
   and active = true;

-- ── grant_purchase_credits — snap_* 패키지 처리 추가 ─────────────
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

  -- (a) idempotency
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
  elsif p_package_code = 'snap_20' then
    granted_snap := 20;
  elsif p_package_code = 'snap_50' then
    granted_snap := 50;
  elsif p_package_code = 'snap_100' then
    granted_snap := 100;
    -- 풀패키지에 영구소장 1개 보너스 — 마케팅 약속과 일치.
    granted_archive := 1;
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_archive, 'purchase', 'purchase_orders', null, p_package_code);
  end if;

  if granted_snap > 0 then
    insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_snap, 'purchase', 'purchase_orders', null, p_package_code);
  end if;

  -- (c) purchase_orders 기록. granted_credits 는 발행권 기준으로 둠 (legacy 컬럼).
  insert into public.purchase_orders (
    user_id, source, package_code, amount, granted_credits,
    portone_payment_id, naver_product_order_no, naver_product_no, status, raw
  ) values (
    p_user_id, p_source, p_package_code, p_amount,
    case when p_package_code = 'basic' then granted_publish else 0 end,
    p_portone_payment, p_naver_order_no, p_naver_product_no, 'completed', p_raw
  ) returning id into order_id;

  return jsonb_build_object(
    'order_id',        order_id,
    'idempotent',      false,
    'granted',         granted_publish,
    'granted_archive', granted_archive,
    'granted_snap',    granted_snap,
    'package_code',    p_package_code
  );
end;
$$;

-- ── 차감 RPC ──────────────────────────────────────────────
-- 원자적으로 잔액 검사 + 차감. API route 에서 호출.
-- 반환:
--   { ok: true,  balance: <after> }                 — 차감 성공
--   { ok: false, balance: <before>, reason: '...'} — 잔액 부족
create or replace function public.consume_snap_credit(
  p_user_id uuid,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  -- 동시성 안전을 위해 user 의 ledger 행에 advisory lock (간단 hash).
  perform pg_advisory_xact_lock(hashtext('snap_credit:' || p_user_id::text));

  select coalesce(sum(delta), 0)::integer
    into current_balance
    from public.snap_credits_ledger
   where user_id = p_user_id;

  if current_balance < 1 then
    return jsonb_build_object('ok', false, 'balance', current_balance, 'reason', 'insufficient');
  end if;

  insert into public.snap_credits_ledger (user_id, delta, reason, note)
  values (p_user_id, -1, 'consume', p_note);

  return jsonb_build_object('ok', true, 'balance', current_balance - 1);
end;
$$;

-- 환불 (실패 보전 등). 멱등성은 호출 측에서 ref_id 로 관리.
create or replace function public.refund_snap_credit(
  p_user_id uuid,
  p_note    text default null,
  p_ref_id  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (p_user_id, 1, 'refund', 'snap_request', p_ref_id, p_note);
end;
$$;

-- ── 백필 — 기존 ai_snap 구매자에게 일괄 20 크레딧 ─────────────
-- 사용자당 ai_snap 구매 1회 = +20. 중복 적립 방지를 위해 note 검사로 멱등.
do $$
declare
  rec record;
begin
  for rec in
    select distinct user_id
      from public.purchase_orders
     where package_code = 'ai_snap'
       and status = 'completed'
  loop
    -- 이미 backfill 됐는지 확인 — 같은 user 의 legacy_migration 행이 있으면 skip.
    if not exists (
      select 1 from public.snap_credits_ledger
       where user_id = rec.user_id and reason = 'legacy_migration'
    ) then
      insert into public.snap_credits_ledger (user_id, delta, reason, note)
      values (rec.user_id, 20, 'legacy_migration', 'ai_snap → snap credits (20)');
    end if;
  end loop;
end$$;
