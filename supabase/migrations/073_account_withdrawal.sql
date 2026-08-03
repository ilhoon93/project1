-- 073_account_withdrawal.sql
--
-- 회원 탈퇴(익명화 방식).
--
-- 정책(개인정보처리방침 준수): 탈퇴 시 개인정보/개인 콘텐츠는 전부 파기하되,
--   전자상거래법상 보존 의무가 있는 결제·거래 기록은 "개인을 식별할 수 없는
--   형태"로만 일정 기간 보존한다.
--
-- 구현 방식:
--   - 개인 데이터 파기: API 가 auth.users 를 hard-delete → 모든 개인 테이블이
--     on delete cascade 로 함께 삭제된다(naver_accounts·profiles·invitations
--     +하객데이터·snap_jobs·anchors·consent·크레딧 원장·quota·purchase_orders 등).
--   - 결제기록 보존: 삭제 직전에 withdraw_user() 로 purchase_orders 의 "비개인정보"
--     거래 필드만 withdrawn_order_records 로 익명 복사한다. user_id 원본과 raw_data
--     (주문자 성명·연락처 등 PII 포함 가능)는 복사하지 않고, 가명키 md5(user_id)만 남긴다.
--
-- withdrawn_order_records 는 auth.users 를 참조하지 않으므로 유저 삭제 후에도 남는다.

-- ═════════════════════════════════════════════════════════════
-- 1. 익명 결제기록 보존 테이블 (auth.users FK 없음 → 탈퇴 후에도 보존)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.withdrawn_order_records (
  id                     uuid primary key default gen_random_uuid(),
  -- 가명키: md5(원 user_id). 원본 식별자·PII 아님. 같은 유저 주문 묶음 대조/중복 방지용.
  user_ref               text,
  source                 text,
  package_code           text,
  portone_payment_id     text,
  naver_order_no         text,
  naver_product_order_no text,
  amount                 integer not null default 0,
  granted_credits        integer not null default 0,
  status                 text,
  ordered_at             timestamptz,   -- 원 결제 시각(purchase_orders.created_at)
  withdrawn_at           timestamptz not null default now()
);

comment on table public.withdrawn_order_records is
  '탈퇴 회원의 결제·거래 기록 익명 보존(전자상거래법). 개인정보(성명·연락처·user_id·raw_data) 미포함.';

create index if not exists idx_withdrawn_order_records_ref
  on public.withdrawn_order_records (user_ref);

-- 일반 사용자/anon 은 접근 불가 (정책 없음 → service_role 및 security definer 함수만).
alter table public.withdrawn_order_records enable row level security;

-- ═════════════════════════════════════════════════════════════
-- 2. withdraw_user — 결제기록을 익명 복사(보존). 개인 데이터 삭제는 호출측
--    (auth.users hard-delete cascade)에서 처리한다.
-- ═════════════════════════════════════════════════════════════
create or replace function public.withdraw_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref      text := md5(p_user_id::text);
  retained integer := 0;
begin
  -- 재시도 멱등성 — 같은 유저의 이전 보존분을 지우고 다시 넣는다.
  delete from public.withdrawn_order_records where user_ref = ref;

  insert into public.withdrawn_order_records
    (user_ref, source, package_code, portone_payment_id, naver_order_no,
     naver_product_order_no, amount, granted_credits, status, ordered_at)
  select ref, source, package_code, portone_payment_id, naver_order_no,
         naver_product_order_no, amount, granted_credits, status, created_at
    from public.purchase_orders
   where user_id = p_user_id;
  get diagnostics retained = row_count;

  return jsonb_build_object('retained_orders', retained);
end;
$$;

-- 서버(service_role)만 호출. 일반 사용자 직접 호출 차단.
revoke execute on function public.withdraw_user(uuid) from anon, authenticated;
