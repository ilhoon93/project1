-- ============================================================
-- 035_pricing_2026_05.sql
--
-- 2026-05 가격 정책 개편 — 사용자 확정 단가 반영.
--
--   알림장(basic)          9,900원 (유지)
--   영구소장(archive_basic) 3,000원 (인하: 14,900 → 3,000)
--   웨딩스냅 5장(snap_5)   7,900원 (인상: 3,900 → 7,900)
--   웨딩스냅 10장(snap_10) 12,900원 (신규)
--   웨딩스냅 20장(snap_20) 19,900원 (인상: 13,900 → 19,900)
--   웨딩스냅 40장(snap_40) 29,900원 (인상: 24,900 → 29,900)
--   웨딩스냅 10장 번들(snap_10_bundle) 9,900원 (신규 — 알림장 결제와 묶음 한정)
--
-- 무료 재생성 quota (snap_10 / snap_10_bundle = 2회 추가):
--   snap_5  → +1   snap_10 → +2   snap_20 → +4   snap_40 → +8
--   snap_10_bundle → +2
--
-- 결제 사용자 첫 앵커 무료 정책(016)은 유지. snap_5/snap_20/snap_40 단가만
-- update 하고 snap_10 / snap_10_bundle 행은 신규 insert.
-- ============================================================

-- ── (1) 단가 변경 ─────────────────────────────────────────
update public.addon_packages
   set price = 3000,
       description = '소장용 URL 영구 보관권 2개 — 결혼식 후에도 메시지·통계가 그대로'
 where code = 'archive_basic';

update public.addon_packages
   set price = 7900,
       description = 'AI 웨딩 스냅 5장 생성 크레딧 (체험용)'
 where code = 'snap_5';

update public.addon_packages
   set price = 19900,
       description = 'AI 웨딩 스냅 20장 생성 크레딧 (가장 인기)'
 where code = 'snap_20';

update public.addon_packages
   set price = 29900,
       description = 'AI 웨딩 스냅 40장 생성 크레딧'
 where code = 'snap_40';

-- ── (2) 신규 SKU 2종 ─────────────────────────────────────
-- snap_10 — 단독 10장 (체험팩과 표준 사이의 진입 옵션)
insert into public.addon_packages
  (code, name, description, price, publish_credits_grant, active, sort_order)
values
  ('snap_10', 'AI 웨딩스냅 소형 패키지', 'AI 웨딩 스냅 10장 생성 크레딧', 12900, 0, true, 20)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      active = excluded.active,
      sort_order = excluded.sort_order;

-- snap_10_bundle — 알림장(basic) 결제와 묶음 한정 SKU, 단독(snap_10) 대비 3,000원 할인.
-- 결제 흐름은 별도 구현 필요 (purchase API 가 basic + snap_10_bundle 동시 grant).
insert into public.addon_packages
  (code, name, description, price, publish_credits_grant, active, sort_order)
values
  (
    'snap_10_bundle',
    'AI 웨딩스냅 알림장 번들 10장',
    '알림장 결제와 함께 구매 가능 — 단독 10장 대비 3,000원 할인',
    9900,
    0,
    true,
    25
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      active = excluded.active,
      sort_order = excluded.sort_order;

-- ── (3) grant_purchase_credits — snap_10 / snap_10_bundle 분기 추가 ──
-- 032 의 함수 signature 와 동일하게 유지, snap_10 / snap_10_bundle 만 추가.
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
  -- 032 마이그에서 도입한 snap_regen_quota_ledger 가 존재하면 함께 적립.
  if granted_regen > 0 then
    begin
      insert into public.snap_regen_quota_ledger (user_id, delta, reason, ref_table, ref_id, note)
      values (p_user_id, granted_regen, 'purchase', 'purchase_orders', null, p_package_code);
    exception when undefined_table then
      -- ledger 가 아직 없는 환경(개발 초기 등)이면 무시 — UI 표시 단계에서만 살아있어도 됨.
      null;
    end;
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

comment on function public.grant_purchase_credits(
  uuid, text, text, integer, text, text, text, jsonb
) is
  '결제 완료 시 패키지별 크레딧 ledger 입금 + purchase_orders 행 생성. 멱등(portone_payment_id / naver_order_no 조합).';
