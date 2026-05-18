-- 022_snap_face_similarity.sql
--
-- snap_jobs 에 face similarity 측정 결과 컬럼 추가.
--
-- 측정 방식: ArcFace / InsightFace 임베딩 cosine similarity.
-- - 입력 사진 (selfie 또는 anchor) vs 생성 결과의 얼굴 cosine sim 0..1
-- - 1.0 = 동일 인물, 0.5+ = 동일 인물로 판정 가능, 0.3- = 다른 사람
--
-- PR 7 에서 finalize 단계에 측정 통합 + quality gate 사용.
-- 본 PR 은 컬럼·스키마만 준비.

alter table public.snap_jobs
  add column if not exists face_similarity_groom numeric(4, 3),
  add column if not exists face_similarity_bride numeric(4, 3),
  -- 'selfie' = 원본 셀카 reference, 'anchor' = 앵커 이미지 reference, 'couple_input' = 커플 사진 원본
  add column if not exists face_similarity_ref text
    check (face_similarity_ref in ('selfie', 'anchor', 'couple_input') or face_similarity_ref is null);

comment on column public.snap_jobs.face_similarity_groom is
  '신랑 얼굴 ArcFace cosine similarity (입력 reference vs 결과). 0..1.';
comment on column public.snap_jobs.face_similarity_bride is
  '신부 얼굴 ArcFace cosine similarity. 0..1. solo 작업에서는 NULL.';

-- 분석용 인덱스 — 평균/분포 쿼리 빠르게.
create index if not exists idx_snap_jobs_face_sim
  on public.snap_jobs (catalog_id, completed_at desc)
  where face_similarity_groom is not null;
