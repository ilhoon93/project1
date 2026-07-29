-- 069_invitation_edit_tracking.sql
--
-- 계측: 사용자가 에디터에서 "실제로 편집을 시작했는지"를 1회 기록한다.
-- (자동저장은 의도적으로 넣지 않음 — 편집 흔적만 남긴다.)
--
-- 배경: 저장은 수동 버튼뿐이라, 편집했지만 저장 안 하고 나간 알림장은
--   updated_at == created_at 이 되어 "껍데기(무제작)"로 오분류됐다. 첫 편집 시점에
--   sendBeacon 으로 이 표를 upsert 해 "편집 흔적 있음"을 남긴다. content/updated_at
--   은 건드리지 않으므로 "저장됨" 판정(updated_at<>created_at)을 오염시키지 않는다.
--
-- 통계의 "제작(수정)됨" 판정을 다음으로 통일한다:
--   was_made = (updated_at <> created_at)  OR  (invitation_edits 에 행 존재)
--   - 이전 데이터: 편집 흔적이 없어 기존 기준(updated_at<>created_at)으로 그대로 판정
--     → 통계 불연속 없음(백필 불필요).
--   - 이후 데이터: 편집했지만 미저장도 제작으로 집계(개선).

-- ═════════════════════════════════════════════════════════════
-- 1. 편집 흔적 테이블
-- ═════════════════════════════════════════════════════════════
create table if not exists public.invitation_edits (
  invitation_id   uuid primary key
    references public.invitations(id) on delete cascade,
  first_edited_at timestamptz not null default now()
);

comment on table public.invitation_edits is
  '알림장 최초 편집 시각(계측). 첫 편집 시 sendBeacon 으로 1회 upsert. 통계의 제작 판정에 사용(자동저장 아님).';

alter table public.invitation_edits enable row level security;

-- 소유자만 자기 알림장의 편집 흔적을 insert/select. 통계 RPC 는 security definer 로 우회.
drop policy if exists "owners insert own invitation_edits" on public.invitation_edits;
create policy "owners insert own invitation_edits"
  on public.invitation_edits for insert
  to authenticated
  with check (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );

drop policy if exists "owners read own invitation_edits" on public.invitation_edits;
create policy "owners read own invitation_edits"
  on public.invitation_edits for select
  to authenticated
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );

-- ═════════════════════════════════════════════════════════════
-- 2. admin_invitation_stats — was_made 를 통합 정의로 교체
--    (054 와 반환 시그니처 동일. 살아있는 invitations 에 편집 흔적 LEFT JOIN 추가.)
-- ═════════════════════════════════════════════════════════════
drop function if exists public.admin_invitation_stats();

create function public.admin_invitation_stats()
returns table (
  signup_count           integer,
  made_customer_count    integer,
  paid_customer_count    integer,
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
  all_inv as (
    select
      i.user_id,
      i.is_published,
      (i.updated_at <> i.created_at or ie.invitation_id is not null) as was_made
    from public.invitations i
    left join public.invitation_edits ie on ie.invitation_id = i.id
    union all
    select user_id, is_published, was_made
    from public.invitation_delete_archive
  )
  select
    (select count(*) from eligible)::int,
    (select count(distinct a.user_id) from all_inv a
       where a.user_id in (select id from eligible) and a.was_made)::int,
    (select count(distinct l.user_id) from public.publish_credits_ledger l
       where l.user_id in (select id from eligible) and l.reason = 'purchase')::int,
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

-- ═════════════════════════════════════════════════════════════
-- 3. public_purchase_conversion_pct — 같은 was_made 통합 정의로 교체
--    (랜딩 "2주 내 구매 결정 N%" — admin 정의와 동일하게 유지.)
-- ═════════════════════════════════════════════════════════════
create or replace function public.public_purchase_conversion_pct()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with eligible as (
    select id from public.admin_stats_eligible_users() as t(id)
  ),
  all_inv as (
    select
      i.user_id,
      i.updated_at,
      (i.updated_at <> i.created_at or ie.invitation_id is not null) as was_made
    from public.invitations i
    left join public.invitation_edits ie on ie.invitation_id = i.id
    union all
    select user_id, updated_at, was_made
    from public.invitation_delete_archive
  ),
  made_users as (
    select a.user_id,
           bool_or(a.updated_at <= now() - interval '14 days') as has_matured
    from all_inv a
    where a.was_made and a.user_id in (select id from eligible)
    group by a.user_id
  ),
  made_users2 as (
    select m.user_id,
           m.has_matured,
           exists (
             select 1 from public.publish_credits_ledger l
              where l.user_id = m.user_id and l.reason = 'purchase'
           ) as has_purchase
    from made_users m
  ),
  agg as (
    select
      (count(*) filter (where has_purchase))::numeric as num,
      (count(*) filter (where has_purchase or has_matured))::numeric as den
    from made_users2
  )
  select case when den > 0 then round(num / den * 100)::int else 0 end
  from agg;
$$;

grant execute on function public.public_purchase_conversion_pct() to anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- 4. 삭제 아카이브 트리거 — was_made 를 편집 흔적까지 반영해 적재
--    BEFORE DELETE 시점엔 invitation_edits 행이 아직 cascade 삭제되지 않아 조회 가능.
--    (기존 트리거는 함수만 교체 — 트리거 재생성 불필요.)
-- ═════════════════════════════════════════════════════════════
create or replace function public.archive_deleted_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.invitation_delete_archive
    (invitation_id, user_id, created_at, updated_at, is_published, was_made)
  values
    (old.id, old.user_id, old.created_at, old.updated_at, old.is_published,
     (old.updated_at <> old.created_at
      or exists (
        select 1 from public.invitation_edits e where e.invitation_id = old.id
      )))
  on conflict (invitation_id) do nothing;
  return old;
end;
$$;
