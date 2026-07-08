-- 052_admin_invitation_stats_eligibility.sql
--
-- 알림장 통계에서 (1) 카카오 등 예전 테스트 계정과 (2) 운영자 계정을 제외하고,
-- 영구소장(archive) 지표를 추가한다.
--
-- 제외 대상(=집계 대상에서 뺀다):
--   - 네이버 미연동 계정(카카오/레거시 테스트) → naver_accounts inner join 으로 제외
--   - 이메일 동의 누락 시 쓰는 가짜 도메인(@users.minimum-wedding.local)
--   - app_metadata.role='admin' 인 운영자 계정
--   - 명시적으로 지정한 운영자 이메일 sayoung5@naver.com / kohkhj902@naver.com
--     (role 플래그가 없더라도 확실히 제외되도록 병행)
--
-- 두 계정이 만든 알림장도 위 eligible 필터로 함께 제외된다.
--
-- 045(admin_user_overview) 의 "네이버 + 실제 이메일" 정책과 같은 결을 공유하되,
-- 통계 전용 eligible 사용자 집합을 함수로 분리해 스칼라 통계와 분포 집계가 같은
-- 기준을 쓰도록 한다.

-- ═════════════════════════════════════════════════════════════
-- 1. 통계 집계 대상 사용자 집합 (single source)
-- ═════════════════════════════════════════════════════════════
create or replace function public.admin_stats_eligible_users()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  join public.naver_accounts na on na.user_id = u.id
  where coalesce(na.email, u.email) not like '%@users.minimum-wedding.local'
    and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
    and coalesce(na.email, u.email) not in (
      'sayoung5@naver.com',
      'kohkhj902@naver.com'
    );
$$;

revoke execute on function public.admin_stats_eligible_users() from anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- 2. 스칼라 통계 (eligible 기준 + 영구소장 지표 추가)
-- ═════════════════════════════════════════════════════════════
-- 반환 컬럼이 050 대비 늘어나므로 drop 후 재생성 (create or replace 는 반환 시그니처
-- 변경 불가).
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
    select id from public.admin_stats_eligible_users()
  )
  select
    (select count(*) from eligible)::int,
    (select count(distinct i.user_id)
       from public.invitations i
      where i.user_id in (select id from eligible)
        and i.updated_at <> i.created_at)::int,
    (select count(distinct l.user_id)
       from public.publish_credits_ledger l
      where l.user_id in (select id from eligible)
        and l.reason = 'purchase')::int,
    (select count(distinct l.user_id)
       from public.archive_credits_ledger l
      where l.user_id in (select id from eligible)
        and l.reason = 'purchase')::int,
    (select count(*)
       from public.invitations i
      where i.user_id in (select id from eligible))::int,
    (select count(*)
       from public.invitations i
      where i.user_id in (select id from eligible)
        and i.updated_at <> i.created_at)::int,
    (select count(*)
       from public.invitations i
      where i.user_id in (select id from eligible)
        and i.is_published)::int,
    (select count(*)
       from public.publications p
      where p.user_id in (select id from eligible)
        and p.archived
        and p.revoked_at is null)::int;
$$;

revoke execute on function public.admin_invitation_stats() from anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- 3. 분포 집계용 — eligible 발행 알림장 content 목록
-- ═════════════════════════════════════════════════════════════
-- content(jsonb) 를 애플리케이션에서 Zod 로 파싱해 테마/레이아웃/폰트/슬라이드
-- 분포를 계산한다(라벨을 코드와 단일 출처로). eligible 필터를 SQL 에서 적용해
-- 스칼라 통계와 같은 모집단을 쓴다.
create or replace function public.admin_published_contents()
returns setof jsonb
language sql
security definer
set search_path = public
as $$
  select i.content
  from public.invitations i
  where i.is_published
    and i.user_id in (select id from public.admin_stats_eligible_users());
$$;

revoke execute on function public.admin_published_contents() from anon, authenticated;
