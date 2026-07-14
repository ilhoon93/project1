-- 058_conversion_matured.sql
--
-- 결제 전환율을 "제작 고객 대비 결제 고객" 비율로 되돌리되, 최종 수정 후 아직
-- 2주가 지나지 않은 건은 (결제할 시간이 충분하지 않으므로) 분모·분자에서 제외한다.
--
--   made_matured_customer_count : 제작(수정)했고 그 알림장의 최종 수정일이
--                                 14일 이전인 고객 수 (=전환율 분모).
--   paid_matured_customer_count : 위 모집단 중 발행권 구매(any time)가 있는 고객 수
--                                 (=전환율 분자).
--
-- 056 에서 넣었던 paid_within_2w_customer_count(수정 후 14일 이내 결제) 는 제거.
-- paid_customer_count(전체 결제 고객)는 그대로 유지.

drop function if exists public.admin_invitation_stats();

create function public.admin_invitation_stats()
returns table (
  signup_count                integer,
  made_customer_count         integer,
  paid_customer_count         integer,
  made_matured_customer_count integer,
  paid_matured_customer_count integer,
  archive_customer_count      integer,
  invitation_count            integer,
  made_invitation_count       integer,
  published_count             integer,
  archived_count              integer
)
language sql
security definer
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  ),
  all_inv as (
    select user_id, is_published, updated_at, (updated_at <> created_at) as was_made
    from public.invitations
    union all
    select user_id, is_published, updated_at, was_made
    from public.invitation_delete_archive
  )
  select
    (select count(*) from eligible)::int,
    (select count(distinct a.user_id) from all_inv a
       where a.user_id in (select id from eligible) and a.was_made)::int,
    (select count(distinct l.user_id) from public.publish_credits_ledger l
       where l.user_id in (select id from eligible) and l.reason = 'purchase')::int,
    -- 전환율 분모: 제작했고 최종 수정 후 14일 지난 고객.
    (select count(distinct a.user_id) from all_inv a
       where a.was_made
         and a.updated_at <= now() - interval '14 days'
         and a.user_id in (select id from eligible))::int,
    -- 전환율 분자: 위 모집단 중 발행권 구매가 있는 고객.
    (select count(distinct a.user_id) from all_inv a
       where a.was_made
         and a.updated_at <= now() - interval '14 days'
         and a.user_id in (select id from eligible)
         and exists (
           select 1 from public.publish_credits_ledger l
            where l.user_id = a.user_id and l.reason = 'purchase'
         ))::int,
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
