-- 059_conversion_paid_or_matured.sql
--
-- 결제(구매) 전환율 정정.
--   - 분자: 제작한 고객 중 결제(발행권 구매)한 고객.
--   - 분모: 제작한 고객에서 "미결제 & 최종 수정 후 2주 미경과" 건만 제외.
--     즉, 이미 결제한 고객은 수정 시점과 무관하게 항상 포함하고, 아직 결제 안 한
--     고객은 최종 수정 후 2주가 지난 경우에만 분모에 포함한다.
--     (아직 결제할 시간이 남은 미결제 최근 건은 전환율에서 빼서 왜곡 방지.)
--
-- 058 의 made_matured/paid_matured 는 결제한 최근 수정 건까지 제외해 과도했음 → 교체.

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
  all_inv as (
    select user_id, is_published, updated_at, (updated_at <> created_at) as was_made
    from public.invitations
    union all
    select user_id, is_published, updated_at, was_made
    from public.invitation_delete_archive
  ),
  -- 제작 고객별: 최종 수정 후 2주 경과 건 보유 여부.
  made_users as (
    select a.user_id,
           bool_or(a.updated_at <= now() - interval '14 days') as has_matured
    from all_inv a
    where a.was_made and a.user_id in (select id from eligible)
    group by a.user_id
  ),
  -- + 결제(발행권 구매) 여부.
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
    -- 전환율 분자: 제작 & 결제.
    (select count(*) from made_users2 where has_purchase)::int,
    -- 전환율 분모: 결제했거나(항상 포함) 최종수정 2주 경과. = 미결제 & 2주 미만 제외.
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
