-- 053_public_maker_payment_rate.sql
--
-- 랜딩 사회적 증거 섹션용: 알림장을 제작한(수정한) 고객 중 결제(발행권 구매)
-- 고객 비율(정수 %). 052 의 eligible 기준(운영자·테스트 계정 제외)을 재사용한다.
--
-- 집계 결과(스칼라 정수)만 노출하므로 anon 실행을 허용한다. eligible 사용자
-- 목록 함수(admin_stats_eligible_users)는 여전히 anon 직접 실행이 막혀 있으나,
-- 이 함수가 security definer 라 내부에서 호출할 수 있다(원 정보는 노출 안 됨).

create or replace function public.public_maker_payment_rate()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  ),
  made as (
    select count(distinct i.user_id) c
    from public.invitations i
    where i.user_id in (select id from eligible)
      and i.updated_at <> i.created_at
  ),
  paid as (
    select count(distinct l.user_id) c
    from public.publish_credits_ledger l
    where l.user_id in (select id from eligible)
      and l.reason = 'purchase'
  )
  select case
    when (select c from made) > 0
      then round((select c from paid)::numeric / (select c from made) * 100)::int
    else 0
  end;
$$;

grant execute on function public.public_maker_payment_rate() to anon, authenticated;
