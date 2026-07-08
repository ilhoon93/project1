-- 054_invitation_delete_archive.sql
--
-- 통계를 "누적"으로 만들기 위한 삭제 아카이브.
--
-- 배경:
--   - 미발행 draft 는 14일 미수정 시 cleanup_stale_drafts() 로 하드 삭제되고,
--     사용자가 마이페이지에서 수동 삭제해도 하드 삭제된다(소프트 삭제/이력 없음).
--   - 그래서 "제작(수정)했다가 삭제된 알림장" 은 invitations 에서 사라져 통계에서
--     빠졌다. (반면 발행 후 30일 만료는 행이 남고 expires_at 만 지나므로 이미 포함.)
--
-- 해결:
--   invitations 에 BEFORE DELETE 트리거를 걸어 삭제 직전 최소 스냅샷을 아카이브
--   테이블에 남긴다. 통계 RPC 는 (살아있는 invitations) + (아카이브) 를 합산해
--   삭제분까지 누적 집계한다. cron·수동·계정삭제 cascade 모든 삭제를 커버한다.
--
-- 한계:
--   이 트리거 적용 "이전에" 이미 삭제된 draft 는 이력이 없어 복구 불가 —
--   적용 이후 삭제분부터 누적된다.
--
-- 주의: content(테마/레이아웃 등)는 저장하지 않는다(용량↓). 발행 알림장 디자인
--   분포는 계속 살아있는 발행 알림장 기준(발행분은 cron 삭제 대상이 아님).

-- ═════════════════════════════════════════════════════════════
-- 1. 아카이브 테이블 (삭제된 알림장의 최소 스냅샷)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.invitation_delete_archive (
  invitation_id uuid primary key,
  -- 계정 삭제 후에도 누적이 유지되도록 auth.users FK/cascade 를 걸지 않는다.
  user_id       uuid not null,
  created_at    timestamptz not null,
  updated_at    timestamptz not null,
  is_published  boolean not null,
  -- 삭제 시점 기준 "제작(수정)됨" 여부 (updated_at <> created_at).
  was_made      boolean not null,
  archived_at   timestamptz not null default now()
);

comment on table public.invitation_delete_archive is
  '삭제된 알림장의 최소 스냅샷(누적 통계용). BEFORE DELETE 트리거로 적재. content 미보관.';

-- 내부(서비스 롤/admin) 전용 — anon/authenticated 직접 접근 차단.
alter table public.invitation_delete_archive enable row level security;
-- 정책을 만들지 않으면 anon/authenticated 는 접근 불가. service_role 은 RLS 우회.

-- ═════════════════════════════════════════════════════════════
-- 2. BEFORE DELETE 트리거 — 삭제 직전 스냅샷 적재
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
     (old.updated_at <> old.created_at))
  on conflict (invitation_id) do nothing;
  return old;
end;
$$;

drop trigger if exists trg_archive_deleted_invitation on public.invitations;
create trigger trg_archive_deleted_invitation
  before delete on public.invitations
  for each row
  execute function public.archive_deleted_invitation();

-- ═════════════════════════════════════════════════════════════
-- 3. 통계 RPC — 살아있는 invitations + 아카이브 합산(누적)
-- ═════════════════════════════════════════════════════════════
-- 반환 시그니처는 052 와 동일(8컬럼) → drop 후 재생성.
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
    select user_id, is_published, (updated_at <> created_at) as was_made
    from public.invitations
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
