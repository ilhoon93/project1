-- 074_snap_catalog_stats_no_auth_users.sql
--
-- Supabase Security Advisor 경고 `auth_users_exposed` (Critical) 대응.
--
-- 문제: 067 에서 public.snap_catalog_stats(뷰, anon·authenticated 에 SELECT 공개)가
--   운영자 제외를 위해 auth.users 를 직접 참조하도록 바뀌었다. 이 뷰는 소유자
--   (postgres) 권한으로 실행되므로 anon 이 조회해도 auth.users 를 읽게 되어, 린터가
--   "auth.users 가 API 로 노출됨"으로 플래그한다. (뷰 출력 컬럼에는 이메일 등 PII 가
--   없고 auth.users 는 WHERE 절 서브쿼리에서 운영자 user_id 필터로만 쓰이지만,
--   공개 뷰가 auth.users 를 참조하는 것 자체가 경고 대상이며 모범사례에 어긋난다.)
--
-- 수정: 운영자 user_id 조회를 SECURITY DEFINER 함수 admin_user_ids() 로 캡슐화하고,
--   뷰는 auth.users 대신 그 함수를 호출한다. → 뷰 정의에서 auth.users 직접 참조가
--   사라져 경고가 해소된다. 함수는 anon/authenticated 직접 실행 불가(revoke)지만,
--   뷰가 소유자 권한으로 실행되며 그 안의 함수 호출도 소유자 권한으로 처리되므로,
--   anon 은 뷰 SELECT 권한만으로 기존과 동일하게 조회할 수 있다(동작 변화 없음).

-- 1) 운영자 user_id 집합 — auth.users 접근을 이 함수 안에 가둔다.
create or replace function public.admin_user_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id
  from auth.users
  where coalesce(raw_app_meta_data ->> 'role', '') = 'admin';
$$;

revoke execute on function public.admin_user_ids() from anon, authenticated;

-- 2) 뷰 재정의 — auth.users 직접 참조를 admin_user_ids() 호출로 대체(출력 컬럼 동일).
create or replace view public.snap_catalog_stats as
select
  catalog_id,
  case
    when catalog_path in ('anchored', 'selfies') then 'selfies'
    when catalog_path = 'couple' then 'couple'
    else 'unknown'
  end as mode,
  count(*) filter (where status = 'completed') as gen_count,
  count(*) filter (where liked = true) as like_count,
  count(*) filter (where regen_to_job_id is not null) as regen_count,
  case
    when count(*) filter (where status = 'completed') = 0 then 0
    else round(
      (count(*) filter (where regen_to_job_id is not null))::numeric
        / count(*) filter (where status = 'completed'),
      3
    )
  end as regen_rate,
  case
    when count(*) filter (where status = 'completed') = 0 then 0
    else round(
      (count(*) filter (where liked = true))::numeric
        / count(*) filter (where status = 'completed'),
      3
    )
  end as like_rate
from public.snap_jobs
where kind = 'catalog'
  and catalog_id is not null
  -- 운영자 계정이 만든 내역은 통계에서 제외(테스트 노이즈 제거). auth.users 직접 참조
  -- 대신 admin_user_ids() 로 캡슐화해 공개 뷰가 auth.users 를 노출하지 않게 한다.
  and user_id not in (select public.admin_user_ids())
group by catalog_id, mode;

comment on view public.snap_catalog_stats is
  '카탈로그 × 모드 (selfies / couple) 별 좋아요/생성/재생성 aggregate.
   admin 통계 페이지 + 사용자 페이지 "인기순" 정렬에 사용.
   운영자(app_metadata.role=admin) 계정이 만든 내역은 제외(admin_user_ids()).
   like_rate = like_count / gen_count, regen_rate = regen_count / gen_count.
   30일/60일 등 기간 필터링은 caller 가 직접 (이 view 는 lifetime cumulative).';

-- 뷰 권한 — 출력에 PII 없음. 사용자 "인기순" 정렬 + admin 통계 페이지가 read.
grant select on public.snap_catalog_stats to authenticated, anon;
