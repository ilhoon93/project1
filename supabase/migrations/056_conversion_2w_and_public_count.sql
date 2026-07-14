-- 056_conversion_2w_and_public_count.sql
--
-- (1) 결제 전환율을 "최종 수정일 이후 14일 이내 결제" 기준으로 측정하기 위해
--     admin_invitation_stats 에 paid_within_2w_customer_count 컬럼 추가.
--     = 제작(수정)한 알림장이 있고, 그 알림장의 updated_at 로부터 14일 이내에
--       발행권 구매(publish_credits_ledger reason='purchase')가 있는 고객 수.
--     기존 paid_customer_count(전체 결제 고객)는 그대로 유지.
--
-- (2) 랜딩 사회적 증거 "커플 수" 자동 계산용 공개 RPC — eligible 기준 발행 알림장
--     건수(살아있음 + 삭제 아카이브). 결과 정수만 노출하므로 anon 실행 허용.

-- ─────────────────────────────────────────────────────────────
drop function if exists public.admin_invitation_stats();

create function public.admin_invitation_stats()
returns table (
  signup_count                  integer,
  made_customer_count           integer,
  paid_customer_count           integer,
  paid_within_2w_customer_count integer,
  archive_customer_count        integer,
  invitation_count              integer,
  made_invitation_count         integer,
  published_count               integer,
  archived_count                integer
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
    -- 제작 후 14일 이내 결제 고객 (전환율 분자).
    (select count(distinct a.user_id) from all_inv a
       where a.was_made
         and a.user_id in (select id from eligible)
         and exists (
           select 1 from public.publish_credits_ledger l
            where l.user_id = a.user_id
              and l.reason = 'purchase'
              and l.created_at >= a.updated_at
              and l.created_at <= a.updated_at + interval '14 days'
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

-- ─────────────────────────────────────────────────────────────
create or replace function public.public_published_couple_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  )
  select (
    (select count(*) from public.invitations i
       where i.is_published and i.user_id in (select id from eligible))
    + (select count(*) from public.invitation_delete_archive a
       where a.is_published and a.user_id in (select id from eligible))
  )::int;
$$;

grant execute on function public.public_published_couple_count() to anon, authenticated;
