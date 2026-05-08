-- ============================================================
-- 008_archive_and_packages.sql
--
--   * publications.archived — 소장용 URL "영구소장" 적용 여부
--   * archive_credits_ledger — 영구소장 크레딧 원장 (publish_credits_ledger 패턴 동일)
--   * archive_credits_balance / apply_archive RPC
--   * 새 addon_packages: 영구소장 / AI 웨딩 스냅 / AI 웨딩 영상 / 가족
--   * publish_invitation_v4 — 만료 기준을 "결혼식 날짜 + 30일" 로 변경 (없으면 발행+30일 폴백)
-- ============================================================

-- ── publications.archived 컬럼 ─────────────────────────────
alter table public.publications
  add column if not exists archived boolean not null default false;

-- ── archive_credits_ledger ─────────────────────────────────
create table if not exists public.archive_credits_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  ref_table  text,
  ref_id     uuid,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_archive_credits_ledger_user on public.archive_credits_ledger (user_id);

alter table public.archive_credits_ledger enable row level security;
drop policy if exists "archive_ledger select self" on public.archive_credits_ledger;
create policy "archive_ledger select self"
  on public.archive_credits_ledger for select
  using (auth.uid() = user_id);

-- 잔액 조회.
create or replace function public.archive_credits_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
    from public.archive_credits_ledger
   where user_id = uid;
$$;

-- 영구소장 적용 — 1 크레딧 차감 + publications.archived = true.
create or replace function public.apply_archive(pub_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller    uuid := auth.uid();
  pub       record;
  balance   integer;
begin
  if caller is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into pub from public.publications
   where id = pub_id and user_id = caller
   for update;
  if not found then
    raise exception 'Not found or unauthorized' using errcode = 'P0002';
  end if;
  if pub.archived then
    raise exception 'Already archived' using errcode = 'P0003';
  end if;

  select coalesce(sum(delta), 0)::integer into balance
    from public.archive_credits_ledger where user_id = caller;
  if balance < 1 then
    raise exception 'Insufficient archive credits (balance=%)', balance using errcode = 'P0001';
  end if;

  insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'archive_apply', 'publications', pub_id, 'apply_archive');

  update public.publications
     set archived = true
   where id = pub_id;

  return jsonb_build_object('success', true, 'publication_id', pub_id);
end;
$$;

-- ── 새 addon_packages ─────────────────────────────────────
-- 'basic' 이외 패키지를 카탈로그에 등록. 1구매 = 영구소장 2개. AI 스냅/영상/가족은
-- entitlement 형태로 grant_purchase_credits 가 처리한다 (아래 함수 분기).
insert into public.addon_packages (code, name, description, price, publish_credits_grant, sort_order)
values
  ('archive_basic', '영구소장 패키지', '소장용 URL 영구 보관권 2개 — 결혼식 후에도 메시지·통계가 그대로', 14900, 0, 10),
  ('ai_snap',       'AI 웨딩 스냅 패키지', 'AI 인페인팅으로 컨셉별 웨딩 사진 생성', 19900, 0, 20),
  ('ai_video',      'AI 웨딩 영상 패키지', 'AI 웨딩 영상 생성 기능', 29900, 0, 30),
  ('family_pack',   '가족 패키지', '가족 정보 + 가족별 사진 슬라이드 확장', 9900, 0, 40)
on conflict (code) do nothing;

-- ── grant_purchase_credits 확장 — 패키지별로 분기 처리 ─────
-- 기존 함수는 publish_credits_grant 만 보고 publish_credits_ledger 에 +N 했다.
-- 영구소장은 archive_credits_ledger 로, AI/family 는 별도 ledger 가 없으니 purchase_orders
-- 만으로 entitlement 를 판단한다 (아래 RPC user_has_package 참고).
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
  order_id         uuid;
begin
  -- 패키지 정보 조회.
  select * into pkg from public.addon_packages where code = p_package_code;
  if not found then
    raise exception 'Unknown package: %', p_package_code using errcode = 'P0002';
  end if;

  -- (a) idempotency — 같은 portone_payment_id 또는 (source, naver_product_order_no)
  --     로 이미 등록된 order 가 있으면 그 order_id 만 반환.
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

  -- (b) ledger 입금 — 발행권 / 영구소장 패키지에 한해 자동 적립.
  if p_package_code = 'basic' then
    granted_publish := pkg.publish_credits_grant;
    insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_publish, 'purchase', 'purchase_orders', null, p_package_code);
  elsif p_package_code = 'archive_basic' then
    -- 1 구매 = 영구소장 2개 지급.
    granted_archive := 2;
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted_archive, 'purchase', 'purchase_orders', null, p_package_code);
  end if;

  -- (c) purchase_orders 기록.
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
    'package_code',    p_package_code
  );
end;
$$;

-- ── 사용자가 특정 패키지를 한 번이라도 구매했는지 ──────────
-- AI 스냅 / 영상 / 가족 처럼 한 번 사면 영구 잠금해제되는 entitlement 판정용.
create or replace function public.user_has_package(uid uuid, pkg_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.purchase_orders
     where user_id = uid
       and package_code = pkg_code
       and status = 'completed'
  );
$$;

-- ── publish_invitation_v4 ─────────────────────────────────
-- expires_at 계산을 "결혼식 날짜 + 30일" 로 변경 (없으면 now() + 30일 폴백).
-- 그 외엔 v3 와 동일.
create or replace function public.publish_invitation_v4(
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

  -- 만료 기준: 결혼식 날짜 + 30일. 없으면 발행 + 30일.
  if inv.wedding_date is not null then
    expires := (inv.wedding_date::timestamptz + interval '30 days');
  else
    expires := now() + interval '30 days';
  end if;

  insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'publish', 'invitations', inv_id, 'publish_invitation_v4')
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
