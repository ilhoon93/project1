-- 031_snap_feedback_columns_and_stats_view.sql
--
-- 마이페이지 결과 카드 피드백 (좋아요 / 재생성) + 카탈로그×모드 통계 view.
--
-- 별도 snap_feedback 테이블 대신 snap_jobs 에 컬럼 추가하는 방식 — 1:1 대응이고
-- join 부담 없음. 재생성 chain 은 self-FK (regen_to_job_id) 로 연결.
--
-- ── 신규 컬럼 ─────────────────────────────────────────────
--   liked            : 사용자가 결과에 좋아요 누른 상태 (토글 가능)
--   liked_at         : 좋아요 누른 timestamp (취소 시 null)
--   regen_reason     : 재생성 시 사용자가 고른 불만족 이유 enum
--   regen_to_job_id  : 재생성으로 새로 만든 child snap_jobs row id
--   regen_used_free  : 이 결과에 대해 무료 1회 재생성을 이미 썼는지
--
-- 1회 한정 무료 재생성 정책 — 한 catalog 결과 (= snap_jobs row) 당 처음 재생성은
-- 무료, 그 이후는 1 크레딧 차감. regen_used_free 가 그 추적 flag.
--
-- ── snap_catalog_stats view ──────────────────────────────
-- 카탈로그 × 모드 (anchor / couple) 별 좋아요/생성/재생성 aggregate.
-- admin 통계 페이지 + 사용자 페이지 정렬 ("좋아요순", "인기순") 에 사용.
-- 데이터 자체에 PII 가 없어 authenticated 모두 읽기 허용.

-- ═════════════════════════════════════════════════════════════
-- 1. snap_jobs 신규 컬럼
-- ═════════════════════════════════════════════════════════════

alter table public.snap_jobs
  add column if not exists liked boolean not null default false,
  add column if not exists liked_at timestamptz,
  add column if not exists regen_reason text
    check (
      regen_reason in ('face_unnatural', 'pose_diff', 'outfit_bg', 'other')
      or regen_reason is null
    ),
  add column if not exists regen_to_job_id uuid
    references public.snap_jobs(id) on delete set null,
  add column if not exists regen_used_free boolean not null default false;

comment on column public.snap_jobs.liked is
  '마이페이지 결과 카드에서 사용자가 좋아요 눌렀는지. 토글 가능 (true ↔ false).
   admin 통계 view 에서 카탈로그별 호감도 측정에 사용.';
comment on column public.snap_jobs.liked_at is
  '좋아요 누른 timestamp. 취소(false) 하면 null 로 되돌림. 정렬/필터 용도.';
comment on column public.snap_jobs.regen_reason is
  '재생성 시 사용자가 선택한 불만족 이유 enum:
     face_unnatural : 얼굴이 이상해요
     pose_diff      : 컷·포즈가 다르게 나왔어요
     outfit_bg      : 배경/의상이 이상해요
     other          : 기타
   admin 통계로 "어떤 카탈로그가 어떤 이유로 자주 재생성되는지" 분석에 사용.';
comment on column public.snap_jobs.regen_to_job_id is
  '재생성으로 새로 만든 child snap_jobs row id (parent → child). 같은 catalog 의
   재생성 chain 추적용. on delete set null — child 삭제돼도 parent 유지.';
comment on column public.snap_jobs.regen_used_free is
  '이 row 에 대해 무료 재생성 1회를 이미 사용했는지. 추가 재생성은 1 크레딧 차감.';

-- regen lookup index — 재생성 chain 조회 / view aggregation 성능 보강.
create index if not exists idx_snap_jobs_regen_to
  on public.snap_jobs (regen_to_job_id)
  where regen_to_job_id is not null;

create index if not exists idx_snap_jobs_liked
  on public.snap_jobs (catalog_id, liked)
  where liked = true;

-- ═════════════════════════════════════════════════════════════
-- 2. snap_catalog_stats view
-- ═════════════════════════════════════════════════════════════

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
where kind = 'catalog' and catalog_id is not null
group by catalog_id, mode;

comment on view public.snap_catalog_stats is
  '카탈로그 × 모드 (selfies / couple) 별 좋아요/생성/재생성 aggregate.
   admin 통계 페이지 + 사용자 페이지 "인기순" 정렬에 사용.
   like_rate = like_count / gen_count, regen_rate = regen_count / gen_count.
   30일/60일 등 기간 필터링은 caller 가 직접 (이 view 는 lifetime cumulative).';

-- view 권한 — 데이터에 PII 없어 authenticated/anon 모두 read.
grant select on public.snap_catalog_stats to authenticated, anon;
