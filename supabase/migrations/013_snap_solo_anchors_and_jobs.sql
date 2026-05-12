-- ============================================================
-- 013_snap_solo_anchors_and_jobs.sql
--
-- 두 가지 큰 변경:
--   1. snap_anchors 재구조 — image_url 단일 컬럼 → groom_anchor_url +
--      bride_anchor_url 로 분리 (solo anchor 아키텍처).
--      기존 함께-anchor 는 solo 와 호환되지 않아 폐기. 사용자에게 무료
--      quota 재부여 효과를 위해 last_batch_at 도 NULL 로 리셋.
--   2. snap_jobs 테이블 신설 — 모든 fal 큐 제출 / finalize 결과를 로깅.
--      fal 대시보드와 별개로 자체 감사 추적 / 디버깅 / 마이페이지 히스토리
--      재료. RLS 는 select self 만 (insert/update 는 service-role).
-- ============================================================

-- ── snap_anchors 재구조 ───────────────────────────────────
-- image_url 컬럼은 함께-anchor 시절 단일 URL 저장. solo 로 전환하면서
-- groom/bride 각 column 으로 분리. 기존 row 의 image_url 데이터는 폐기.
alter table public.snap_anchors
  add column if not exists groom_anchor_url text,
  add column if not exists bride_anchor_url text;

alter table public.snap_anchors
  drop column if exists image_url;

-- 기존 사용자에게 "무료 quota 재부여" — last_batch_at 을 NULL 로 두면 API 가
-- "행은 있지만 아직 batch 안 만듬" 으로 인식해 무료 활성화 quota 가 다시 생긴
-- 것처럼 동작. groom/bride url 도 모두 NULL (앞 alter 로 자동 NULL).
update public.snap_anchors set last_batch_at = null;

-- (해석 단순화를 위해) 코멘트 갱신.
comment on column public.snap_anchors.groom_anchor_url is
  '신랑 단독 앵커 public URL. NULL = 아직 선택 안 됨.';
comment on column public.snap_anchors.bride_anchor_url is
  '신부 단독 앵커 public URL. NULL = 아직 선택 안 됨.';

-- ── snap_jobs ────────────────────────────────────────────
-- fal 큐 제출 / 결과 / 실패까지 모두 한 행으로 추적.
-- kind 별로 의미가 다른 필드:
--   * 'anchor'  → anchor_slot (groom/bride), anchor_framing (closeup/halfbody)
--   * 'catalog' → catalog_id, catalog_path (anchored/selfies/couple)
create table if not exists public.snap_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('anchor', 'catalog')),
  -- fal 측 식별자. 동일 request_id 가 두 번 들어오면 안 되므로 unique.
  fal_request_id  text not null unique,
  model           text not null,
  quality         text,
  -- 카탈로그 작업 한정
  catalog_id      text,
  catalog_path    text check (catalog_path in ('anchored', 'selfies', 'couple') or catalog_path is null),
  -- 앵커 작업 한정
  anchor_slot     text check (anchor_slot in ('groom', 'bride') or anchor_slot is null),
  anchor_framing  text check (anchor_framing in ('closeup', 'halfbody') or anchor_framing is null),
  -- 상태 머신
  status          text not null check (status in ('submitted', 'in_progress', 'completed', 'failed', 'timeout')),
  result_url      text,
  -- 회계 — submit 시점에 차감된 크레딧 (catalog -1, anchor 0 or -4 등)
  credit_delta    integer not null default 0,
  error_message   text,
  submitted_at    timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_snap_jobs_user_time
  on public.snap_jobs (user_id, submitted_at desc);
create index if not exists idx_snap_jobs_fal
  on public.snap_jobs (fal_request_id);

alter table public.snap_jobs enable row level security;

drop policy if exists "snap_jobs select self" on public.snap_jobs;
create policy "snap_jobs select self"
  on public.snap_jobs for select
  using (auth.uid() = user_id);
-- INSERT / UPDATE / DELETE 는 service-role 에서만.
