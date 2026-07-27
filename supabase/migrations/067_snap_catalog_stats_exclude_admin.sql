-- 067_snap_catalog_stats_exclude_admin.sql
--
-- 카탈로그 통계(snap_catalog_stats)에서 운영자 계정이 만든 생성/좋아요/재생성
-- 내역을 집계에서 제외한다.
--
-- 배경: 운영자가 테스트로 돌린 스냅 생성이 카탈로그 통계에 섞여 gen/like/regen
--   수치를 부풀렸다. 관리자 통계 페이지는 물론, 이 view 를 쓰는 사용자 페이지의
--   "인기순"/"좋아요순" 정렬도 테스트 노이즈 없이 실제 사용자 지표만 반영해야 한다.
--
-- 운영자 판정: auth.users.raw_app_meta_data ->> 'role' = 'admin'
--   (checkAdmin / 044·052 마이그와 동일 기준. app_metadata 는 service 키·콘솔에서만
--    set 가능해 사용자가 변조 불가.)
--
-- view 는 소유자(마이그 실행 role) 권한으로 실행되므로 auth.users 참조가 anon
-- caller 에게도 안전하다(기존에도 RLS 걸린 snap_jobs 를 anon 이 이 view 로 읽음).
-- 031 의 view 정의를 그대로 두고 WHERE 에 운영자 제외 조건만 추가.

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
  -- 운영자 계정이 만든 내역은 통계에서 제외(테스트 노이즈 제거).
  and user_id not in (
    select id
    from auth.users
    where coalesce(raw_app_meta_data ->> 'role', '') = 'admin'
  )
group by catalog_id, mode;

comment on view public.snap_catalog_stats is
  '카탈로그 × 모드 (selfies / couple) 별 좋아요/생성/재생성 aggregate.
   admin 통계 페이지 + 사용자 페이지 "인기순" 정렬에 사용.
   운영자(app_metadata.role=admin) 계정이 만든 내역은 제외한다(테스트 노이즈 제거).
   like_rate = like_count / gen_count, regen_rate = regen_count / gen_count.
   30일/60일 등 기간 필터링은 caller 가 직접 (이 view 는 lifetime cumulative).';

-- view 권한 — 데이터에 PII 없어 authenticated/anon 모두 read (031 과 동일).
grant select on public.snap_catalog_stats to authenticated, anon;
