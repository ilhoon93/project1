-- 071_admin_invitation_stats_conversion_restore.sql
--
-- 회귀 수정: 069 에서 admin_invitation_stats() 를 054 시그니처로 재정의하면서
--   059 에 있던 conversion_paid_count / conversion_base_count 두 컬럼이 빠졌다.
--   관리자 통계 페이지(admin/invitation-stats)는 여전히 이 두 값으로
--   "제작 → 결제 전환율" 을 계산하므로, 컬럼이 사라진 뒤로는 분자·분모가 모두
--   0 으로 읽혀 전환율이 "—" 로만 표시되는 문제가 있었다.
--
-- 수정 방침: 069 의 통합 was_made(편집 흔적 invitation_edits 포함) 정의를 그대로
--   유지하면서 두 전환 컬럼만 복원한다. 전환율 정의는 069 의
--   public_purchase_conversion_pct() 와 동일하게 맞춘다:
--     conversion_paid_count = 제작 유저 중 발행권 구매자 수                (분자)
--     conversion_base_count = 제작 유저 중 (구매 or 최종수정 2주 경과) 수  (분모)
--   → 미결제 & 최종수정 2주 미만(아직 결정 중) 건은 분모에서 제외.
--
-- 반환 컬럼 순서/이름은 059 와 동일 — 관리자 페이지의 StatsRow 가 이름으로 읽는다.

drop function if exists public.admin_invitation_stats();

create function public.admin_invitation_stats()
returns table (
  signup_count           integer,
  made_customer_count    integer,
  paid_customer_count    integer,
  conversion_paid_count  integer,
  conversion_base_count  integer,
  archive_customer_count integer,
  invitation_count       integer,
  made_invitation_count  integer,
  published_count        integer,
  archived_count         integer
)
language sql
security definer
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  ),
  -- 살아있는 알림장 + 삭제 아카이브 (동시에 양쪽에 존재하지 않음 → union all 안전).
  -- was_made 는 편집 흔적(invitation_edits)까지 반영한 069 통합 정의.
  all_inv as (
    select
      i.user_id,
      i.is_published,
      i.updated_at,
      (i.updated_at <> i.created_at or ie.invitation_id is not null) as was_made
    from public.invitations i
    left join public.invitation_edits ie on ie.invitation_id = i.id
    union all
    select user_id, is_published, updated_at, was_made
    from public.invitation_delete_archive
  ),
  -- 제작(was_made) 유저별: 2주 경과 제작본을 하나라도 보유했는지.
  made_users as (
    select a.user_id,
           bool_or(a.updated_at <= now() - interval '14 days') as has_matured
    from all_inv a
    where a.was_made and a.user_id in (select id from eligible)
    group by a.user_id
  ),
  -- 제작 유저별 발행권 구매 여부.
  made_users2 as (
    select m.user_id,
           m.has_matured,
           exists (
             select 1 from public.publish_credits_ledger l
              where l.user_id = m.user_id and l.reason = 'purchase'
           ) as has_purchase
    from made_users m
  )
  select
    (select count(*) from eligible)::int,
    (select count(*) from made_users2)::int,
    (select count(distinct l.user_id) from public.publish_credits_ledger l
       where l.user_id in (select id from eligible) and l.reason = 'purchase')::int,
    (select count(*) from made_users2 where has_purchase)::int,
    (select count(*) from made_users2 where has_purchase or has_matured)::int,
    (select count(distinct l.user_id) from public.archive_credits_ledger l
       where l.user_id in (select id from eligible) and l.reason = 'purchase')::int,
    (select count(*) from all_inv a
       where a.user_id in (select id from eligible))::int,
    (select count(*) from all_inv a
       where a.user_id in (select id from eligible) and a.was_made)::int,
    (select count(*) from all_inv a
       where a.user_id in (select id from eligible) and a.is_published)::int,
    (select count(*) from public.publications p
       where p.user_id in (select id from eligible)
         and p.archived and p.revoked_at is null)::int;
$$;

revoke execute on function public.admin_invitation_stats() from anon, authenticated;
