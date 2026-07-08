-- 050_admin_invitation_stats.sql
--
-- 운영자 전용 알림장 상품 통계 집계 RPC.
--
-- 반환 스칼라(단일 행):
--   signup_count           : 전체 가입 계정 수 (auth.users).
--   made_customer_count    : 실제로 알림장을 "제작"해 본 고객 수.
--                            제작 판정 = 최초 등록시각(created_at)과 최종 수정시각
--                            (updated_at)이 다른 알림장이 1건이라도 있는 user.
--   paid_customer_count    : 알림장(발행권=basic 패키지) 결제 고객 수.
--                            publish_credits_ledger 에 reason='purchase' 기록이 있는 user.
--   invitation_count       : 전체 알림장 수.
--   made_invitation_count  : 제작(수정)된 알림장 수 (updated_at <> created_at).
--   published_count        : 발행된 알림장 수.
--
-- 발행된 알림장의 테마/레이아웃/폰트/슬라이드 선택 분포는 content(jsonb) 를
-- 애플리케이션(서버 컴포넌트)에서 Zod 로 파싱해 집계한다 — 라벨/스키마를 코드와
-- 단일 출처로 맞추기 위함. 여기서는 스칼라 카운트만 담당.
--
-- 권한: security definer + authenticated/anon 실행권 회수 → service_role(=admin
-- 페이지의 createAdminClient) 로만 호출. admin_user_overview(045) 와 동일 패턴.

create or replace function public.admin_invitation_stats()
returns table (
  signup_count           integer,
  made_customer_count    integer,
  paid_customer_count    integer,
  invitation_count       integer,
  made_invitation_count  integer,
  published_count        integer
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from auth.users)::int,
    (select count(distinct user_id)
       from public.invitations
      where updated_at <> created_at)::int,
    (select count(distinct user_id)
       from public.publish_credits_ledger
      where reason = 'purchase')::int,
    (select count(*) from public.invitations)::int,
    (select count(*)
       from public.invitations
      where updated_at <> created_at)::int,
    (select count(*) from public.invitations where is_published)::int;
$$;

revoke execute on function public.admin_invitation_stats() from anon, authenticated;
