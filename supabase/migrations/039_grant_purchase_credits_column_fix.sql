-- ============================================================
-- 039_grant_purchase_credits_column_fix.sql
--
-- grant_purchase_credits 정정 — 실제 purchase_orders 컬럼명/멱등성 키 교정.
--
-- 배경:
--   008 이후의 함수 본문이 purchase_orders 에 INSERT 하면서 실제 테이블(004)
--   에 없는 컬럼(naver_product_no / raw / completed_at)을 참조해 왔다. 또한
--   네이버 수동 등록의 멱등성 키가 p_naver_order_no(주문번호) 로 잘못 잡혀,
--   Commerce API 미설정(=p_naver_order_no NULL) 시 멱등성 검사가 통째로
--   건너뛰어져 같은 상품주문번호를 여러 번 등록하면 중복 적립될 수 있었다.
--
-- 정정:
--   1. INSERT 컬럼을 004 의 실제 컬럼(naver_order_no / naver_product_order_no /
--      raw_data / processed_at / granted_credits)으로 되돌린다.
--   2. 네이버 멱등성 키를 "상품주문번호"(= p_naver_product_no, 유니크 단위이자
--      idx_orders_naver_product_order 유니크 인덱스 대상) 기준으로 정정한다.
--      라우트(/api/orders/register)는 이미 사용자 입력 상품주문번호를
--      p_naver_product_no 로 넘기고, 사전 중복검사도 naver_product_order_no
--      컬럼으로 하므로 라우트 수정 없이 정합성이 맞는다.
--   3. 035 의 패키지별 적립 분기(스냅/재생성/영구소장 보너스 등)는 그대로 유지.
--
-- signature 는 035 와 동일 — create or replace 로 본문만 교체.
-- ============================================================
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
  -- 네이버 수동 등록은 "상품주문번호"(유니크 단위) 로 멱등 처리.
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

  -- (b2) regen quota — snap 결제 시 카탈로그 재생성 무료 quota 증분.
  if granted_regen > 0 then
    begin
      insert into public.snap_regen_quota_ledger (user_id, delta, reason, ref_table, ref_id, note)
      values (p_user_id, granted_regen, 'purchase', 'purchase_orders', null, p_package_code);
    exception when undefined_table then
      null;
    end;
  end if;

  -- (c) purchase_orders 행 생성 — 004 의 실제 컬럼명 사용.
  --     granted_credits 는 발행권 기준 legacy 컬럼(012 주석 참고).
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

comment on function public.grant_purchase_credits(
  uuid, text, text, integer, text, text, text, jsonb
) is
  '결제 완료 시 패키지별 크레딧 ledger 입금 + purchase_orders 행 생성. 멱등(portone_payment_id / 네이버 상품주문번호). 039 에서 컬럼명·멱등성 키 정정.';
