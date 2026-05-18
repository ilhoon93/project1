-- 023_snap_couple_photo_ref.sql
--
-- 커플 모드 face restore + similarity gate 를 위한 couple_photo_path / url 보존.
--
-- 현재 mode='couple' 작업은 사용자가 업로드한 커플 사진 URL 을 fal 에 한 번
-- 전달한 뒤 snap_jobs 행에 남기지 않음. PR 7 에서 finalize 단계 face-swap
-- restore (couple 사진 reference) + face similarity 측정에 필요해 영구 저장.

alter table public.snap_jobs
  add column if not exists couple_photo_url text,
  add column if not exists couple_photo_path text;

comment on column public.snap_jobs.couple_photo_url is
  '커플 모드: 사용자가 업로드한 커플 사진의 signed URL (PR 3 적용 후 private 버킷).';
comment on column public.snap_jobs.couple_photo_path is
  '커플 모드: 커플 사진의 private-uploads 버킷 경로. signed URL 재발급용.';

create index if not exists idx_snap_jobs_couple_path
  on public.snap_jobs (couple_photo_path)
  where catalog_path = 'couple';
