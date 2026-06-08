-- ============================================================
-- 043_smartstore_order_raw_breakdown.sql
--
-- grant_smartstore_order 가 purchase_orders.raw_data 에 옵션 라벨 + 적립
-- 내역(발행권/영구소장/스냅/재생성)을 함께 저장하도록 보강.
--
-- 배경: 주문 내역 화면이 package_code 로만 표기해 스마트스토어 번들 주문은
--   'unknown' 으로 떴고, 적립 크레딧도 발행권만 보였다. raw_data 에 라벨과
--   적립 breakdown 을 남겨 두면 화면에서 "알림장 + 영구소장 · 발행권 +1 ·
--   영구소장 +1" 처럼 정확히 표기할 수 있다.
--
-- 042 의 grant_smartstore_order 와 동일하되 (c) purchase_orders INSERT 의
-- raw_data 만 확장. 함수 시그니처/적립 로직은 그대로.
-- ============================================================
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
  -- (a) idempotency — 상품주문번호 기준.
  if p_naver_product_order_no is not null then
    select id into order_id from public.purchase_orders
     where naver_product_order_no = p_naver_product_order_no;
    if order_id is not null then
      return jsonb_build_object('order_id', order_id, 'idempotent', true, 'granted', 0);
    end if;
  end if;

  -- (b) 옵션 매핑 조회.
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

  -- (c) 크레딧별 ledger 입금.
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
  -- 무료 재생성 quota — snap_user_quota upsert.
  if g.regen_grant > 0 then
    insert into public.snap_user_quota (user_id, free_regen_remaining, total_granted, updated_at)
    values (p_user_id, g.regen_grant, g.regen_grant, now())
    on conflict (user_id) do update
      set free_regen_remaining = public.snap_user_quota.free_regen_remaining + excluded.free_regen_remaining,
          total_granted        = public.snap_user_quota.total_granted        + excluded.total_granted,
          updated_at           = now();
  end if;

  -- (d) purchase_orders 행 — raw_data 에 라벨 + 적립 breakdown 저장.
  insert into public.purchase_orders (
    user_id, source, package_code, amount, granted_credits,
    naver_order_no, naver_product_order_no, raw_data, status, processed_at
  ) values (
    p_user_id, 'naver_smartstore', null, coalesce(p_amount, 0), g.publish_grant,
    p_naver_order_no, p_naver_product_order_no,
    coalesce(p_raw, '{}'::jsonb) || jsonb_build_object(
      'option_label', g.label,
      'granted', jsonb_build_object(
        'publish', g.publish_grant,
        'archive', g.archive_grant,
        'snap',    g.snap_grant,
        'regen',   g.regen_grant
      )
    ),
    'completed', now()
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
