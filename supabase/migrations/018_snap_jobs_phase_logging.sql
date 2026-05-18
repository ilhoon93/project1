-- 018_snap_jobs_phase_logging.sql
--
-- snap_jobs 에 단계별 비용·타이밍 로깅 컬럼 추가.
--
-- 도입 이유: 가격 정책 조정 / 디버깅 / A/B 측정 모두 측정 데이터 없이는 추측이
-- 됨. 이 컬럼들이 깔려야 후속 face-similarity gate, premium tier, upscale 위치
-- A/B 등 모든 품질·마진 작업이 객관적 근거로 진행 가능.
--
-- 컬럼:
--   * fal_cost_usd            : finalize 시점에 합산한 fal 호출 총 비용 (USD).
--                                gen + face-swap + harmonize + finishing + upscale.
--   * phase_timings           : 각 단계 소요 시간(ms) JSONB.
--                                예: {"submit_ms": 1200, "harmonize_ms": 800, ...}
--   * pipeline_stages         : 어떤 단계가 실행/스킵됐는지 JSONB.
--                                예: {"face_swap": true, "harmonize": true,
--                                     "finishing": false, "upscale": "aura-sharpen"}
--   * input_face_count        : input validation 단계에서 검출된 얼굴 수 (NULL 허용).
--   * input_face_min_size     : 검출 얼굴 중 가장 작은 변 픽셀 (NULL 허용).
--   * input_avg_luminance     : 입력 사진 평균 luminance 0..255 (NULL 허용).
--
-- 모든 컬럼 NULL 허용 — 기존 행과 충돌 없음. 후속 fill-in 정책은 finalize 갱신에서.

alter table public.snap_jobs
  add column if not exists fal_cost_usd numeric(10, 4),
  add column if not exists phase_timings jsonb,
  add column if not exists pipeline_stages jsonb,
  add column if not exists input_face_count integer,
  add column if not exists input_face_min_size integer,
  add column if not exists input_avg_luminance numeric(6, 2);

-- 누적 비용 / 평균 시간 등 대시보드용 쿼리를 위한 보조 인덱스.
-- 비용 집계 (catalog 만 의미 있음) 쿼리가 빠르게.
create index if not exists idx_snap_jobs_kind_completed_cost
  on public.snap_jobs (kind, completed_at desc)
  where status = 'completed' and fal_cost_usd is not null;

comment on column public.snap_jobs.fal_cost_usd is
  'finalize 시점에 합산한 fal 호출 총 USD. gen + face-swap + harmonize + finishing + upscale 의 합.';
comment on column public.snap_jobs.phase_timings is
  '각 파이프라인 단계 wall-clock ms. 키 예: submit_ms, fal_wait_ms, face_swap_ms, harmonize_ms, finishing_ms, upscale_ms, postprocess_ms.';
comment on column public.snap_jobs.pipeline_stages is
  '단계별 실행 여부 / 모드. 키 예: face_swap (bool), harmonize (mode), finishing (mode), upscale (mode).';
