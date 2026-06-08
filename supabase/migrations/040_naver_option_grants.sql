-- ============================================================
-- 040_naver_option_grants.sql
--
-- 스마트스토어 "옵션 단위" 크레딧 매핑 + 다중 크레딧 번들 적립.
--
-- 배경:
--   스마트스토어 상품은 2개뿐이지만 각 상품에 옵션이 여러 개고, 일부 옵션은
--   한 번에 여러 종류의 크레딧을 지급하는 "번들"이다. 예) 알림장 상품의
--   "영구소장,웨딩스냅 5장" 옵션 = 발행권 + 영구소장 + 스냅 + 재생성 동시 지급.
--
--   기존 grant_purchase_credits 는 package_code 하나로만 분기해 번들을 표현할
--   수 없다. 그래서 (상품번호 + 옵션코드) → 각 크레딧 수량을 직접 정의하는
--   매핑 테이블과, 그 정의대로 여러 ledger 에 입금하는 함수를 둔다.
--
--   옵션코드는 커머스 API 상품주문 상세의 productOrder.optionCode 와 매칭한다.
-- ============================================================

create table if not exists public.naver_option_grants (
  product_no    text    not null,          -- 상품번호 (커머스 API productId / 스토어 URL)
  option_code   text    not null,          -- 옵션코드 (productOrder.optionCode)
  label         text,                      -- 사람용 설명 (주문 내역/ledger note 표기)
  publish_grant integer not null default 0, -- 발행권
  archive_grant integer not null default 0, -- 영구소장권
  snap_grant    integer not null default 0, -- 웨딩스냅 크레딧
  regen_grant   integer not null default 0, -- 무료 재생성 quota
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  primary key (product_no, option_code)
);

comment on table public.naver_option_grants is
  '스마트스토어 (상품번호, 옵션코드) → 지급 크레딧 매핑. grant_smartstore_order 가 참조.';

alter table public.naver_option_grants enable row level security;

-- 카탈로그성 데이터 — 누구나 읽기 가능, 쓰기는 service role 전용(정책 없음).
create policy "anyone reads naver_option_grants"
  on public.naver_option_grants for select
  using (true);

-- ============================================================
-- grant_smartstore_order — 옵션 매핑대로 다중 크레딧 적립.
--
-- 멱등: 같은 상품주문번호(naver_product_order_no) 가 이미 있으면 재적립하지 않음.
-- 매핑이 없으면 'option_not_mapped' 를 돌려줘 라우트가 친절히 안내하게 한다.
-- package_code 는 단일 코드로 표현 불가한 번들이 있어 NULL 로 둔다(FK 회피).
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
  if g.regen_grant > 0 then
    begin
      insert into public.snap_regen_quota_ledger (user_id, delta, reason, ref_table, ref_id, note)
      values (p_user_id, g.regen_grant, 'purchase', 'purchase_orders', null, note_txt);
    exception when undefined_table then
      null;
    end;
  end if;

  -- (d) purchase_orders 행 (감사/내역). package_code 는 번들 표현 불가라 NULL.
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

comment on function public.grant_smartstore_order(
  uuid, text, text, integer, text, text, text, jsonb
) is
  '스마트스토어 옵션 매핑(naver_option_grants)대로 다중 크레딧 적립 + purchase_orders 기록. 멱등(상품주문번호).';
