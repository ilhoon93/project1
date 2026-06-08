-- ============================================================
-- 042_fix_regen_quota_grant.sql
--
-- 무료 재생성 quota 적립 버그 수정.
--
-- 문제:
--   재생성 무료 잔량은 032 의 snap_user_quota.free_regen_remaining 에
--   저장되고 /api/snap/regen-quota 가 그 테이블을 읽는다. 그런데 035 에서
--   grant_purchase_credits 의 regen 적립이 "snap_regen_quota_ledger 에 insert,
--   undefined_table 이면 무시" 로 바뀌었고, 그 ledger 테이블은 애초에 존재하지
--   않아 항상 조용히 no-op 됐다. 039(내가 만든 컬럼 수정)·040(스마트스토어
--   적립) 도 같은 잘못된 패턴을 그대로 가져갔다. 결과적으로 035 이후 스냅
--   패키지를 구매해도 무료 재생성 quota 가 증가하지 않았다(스냅 장수는 정상).
--
-- 수정:
--   두 함수(grant_purchase_credits, grant_smartstore_order)의 regen 적립을
--   032 와 동일하게 snap_user_quota upsert 로 되돌린다. 나머지 로직은
--   039/040 그대로(컬럼명·멱등성·다중 크레딧).
-- ============================================================

-- ── grant_purchase_credits (PortOne / basic 등) ──────────────
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
  if p_naver_product_no is not null then
    select id into order_id from public.purchase_orders
     where naver_product_order_no = p_naver_product_no;
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
    granted_snap  := 5;
    granted_regen := 1;
  elsif p_package_code = 'snap_10' then
    granted_snap  := 10;
    granted_regen := 2;
  elsif p_package_code = 'snap_10_bundle' then
    granted_snap  := 10;
    granted_regen := 2;
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

  -- (b2) 무료 재생성 quota — snap_user_quota upsert (032 와 동일하게 수정).
  if granted_regen > 0 then
    insert into public.snap_user_quota (user_id, free_regen_remaining, total_granted, updated_at)
    values (p_user_id, granted_regen, granted_regen, now())
    on conflict (user_id) do update
      set free_regen_remaining = public.snap_user_quota.free_regen_remaining + excluded.free_regen_remaining,
          total_granted        = public.snap_user_quota.total_granted        + excluded.total_granted,
          updated_at           = now();
  end if;

  -- (c) purchase_orders 행 — 004 의 실제 컬럼명.
  insert into public.purchase_orders (
    user_id, source, package_code, amount, granted_credits,
    portone_payment_id, naver_order_no, naver_product_order_no,
    raw_data, status, processed_at
  ) values (
    p_user_id, p_source, p_package_code, coalesce(p_amount, pkg.price), granted_publish,
    p_portone_payment, p_naver_order_no, p_naver_product_no,
    coalesce(p_raw, '{}'::jsonb), 'completed', now()
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

-- ── grant_smartstore_order (스마트스토어 옵션 번들) ──────────
create or replace function public.grant_smartstore_order(
  p_user_id                uuid,
  p_product_no             text,
  p_option_code            text,
  p_amount                 integer,
  p_naver_order_no         text default null,
  p_naver_product_order_no text default null,
  p_raw                    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g         record;
  order_id  uuid;
  note_txt  text;
begin
  if p_naver_product_order_no is not null then
    select id into order_id from public.purchase_orders
     where naver_product_order_no = p_naver_product_order_no;
    if order_id is not null then
      return jsonb_build_object('order_id', order_id, 'idempotent', true, 'granted', 0);
    end if;
  end if;

  select * into g from public.naver_option_grants
   where product_no = p_product_no
     and option_code = p_option_code
     and active;
  if not found then
    return jsonb_build_object(
      'error', 'option_not_mapped',
      'product_no', p_product_no,
      'option_code', p_option_code
    );
  end if;

  note_txt := coalesce(g.label, p_product_no || '/' || p_option_code);

  if g.publish_grant > 0 then
    insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, g.publish_grant, 'purchase', 'purchase_orders', null, note_txt);
  end if;
  if g.archive_grant > 0 then
    insert into public.archive_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, g.archive_grant, 'purchase', 'purchase_orders', null, note_txt);
  end if;
  if g.snap_grant > 0 then
    insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, g.snap_grant, 'purchase', 'purchase_orders', null, note_txt);
  end if;
  -- 무료 재생성 quota — snap_user_quota upsert (032 와 동일하게 수정).
  if g.regen_grant > 0 then
    insert into public.snap_user_quota (user_id, free_regen_remaining, total_granted, updated_at)
    values (p_user_id, g.regen_grant, g.regen_grant, now())
    on conflict (user_id) do update
      set free_regen_remaining = public.snap_user_quota.free_regen_remaining + excluded.free_regen_remaining,
          total_granted        = public.snap_user_quota.total_granted        + excluded.total_granted,
          updated_at           = now();
  end if;

  insert into public.purchase_orders (
    user_id, source, package_code, amount, granted_credits,
    naver_order_no, naver_product_order_no, raw_data, status, processed_at
  ) values (
    p_user_id, 'naver_smartstore', null, coalesce(p_amount, 0), g.publish_grant,
    p_naver_order_no, p_naver_product_order_no,
    coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('option_label', g.label), 'completed', now()
  ) returning id into order_id;

  return jsonb_build_object(
    'order_id', order_id,
    'idempotent', false,
    'label', g.label,
    'granted_publish', g.publish_grant,
    'granted_archive', g.archive_grant,
    'granted_snap', g.snap_grant,
    'granted_regen', g.regen_grant
  );
end;
$$;
