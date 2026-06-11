-- 046_admin_snap_jobs.sql
--
-- 운영자용 AI 웨딩스냅(catalog) 생성내역 + 반응 조회 RPC.
--
-- 목적: /admin/snap-jobs 페이지에서 생성 기록을 최신순으로 페이지네이션하며
--       조회하고, 이메일(네이버/auth)로 필터링한다. 입력/결과 이미지 URL 과
--       반응(liked / 재생성 사유)을 함께 반환한다.
--
-- 이메일 해석은 045(admin_user_overview) 와 동일: naver_accounts.email 우선,
-- 없으면 auth.users.email.
--
-- 입력 이미지:
--   - couple 모드: couple_photo_url(저장 당시 signed, 만료 가능) + couple_photo_path
--     (앱에서 재서명). 둘 다 반환.
--   - anchored/selfies 모드: 사용자의 snap_anchors 셀카 URL(public-images, 영구)
--     을 근사 입력으로 반환.
--
-- security definer + service_role 전용 (revoke). p_limit 은 앱에서 PAGE_SIZE+1 로
-- 호출해 다음 페이지 존재 여부를 판단한다.

-- 전역 최신순 정렬(사용자 필터 없는 기본 조회)을 위한 인덱스. 기존
-- idx_snap_jobs_user_time 은 (user_id, submitted_at) 복합이라 전역 정렬엔 부적합.
create index if not exists idx_snap_jobs_submitted
  on public.snap_jobs (submitted_at desc);

create or replace function public.admin_snap_jobs(
  p_email  text default null,
  p_limit  integer default 31,
  p_offset integer default 0
)
returns table (
  id                uuid,
  user_id           uuid,
  email             text,
  kind              text,
  catalog_id        text,
  catalog_path      text,
  status            text,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  result_url        text,
  couple_photo_url  text,
  couple_photo_path text,
  groom_selfie_url  text,
  bride_selfie_url  text,
  image_reference   text,
  quality           text,
  credit_delta      integer,
  fal_cost_usd      double precision,
  liked             boolean,
  liked_at          timestamptz,
  regen_reason      text,
  regen_reason_text text,
  regen_to_job_id   uuid,
  error_message     text
)
language sql
security definer
set search_path = public
as $$
  select
    sj.id,
    sj.user_id,
    coalesce(na.email, u.email) as email,
    sj.kind,
    sj.catalog_id,
    sj.catalog_path,
    sj.status,
    sj.submitted_at,
    sj.completed_at,
    sj.result_url,
    sj.couple_photo_url,
    sj.couple_photo_path,
    (select a.groom_selfie_url from public.snap_anchors a
       where a.user_id = sj.user_id limit 1) as groom_selfie_url,
    (select a.bride_selfie_url from public.snap_anchors a
       where a.user_id = sj.user_id limit 1) as bride_selfie_url,
    sj.image_reference,
    sj.quality,
    sj.credit_delta,
    sj.fal_cost_usd::float8 as fal_cost_usd,
    sj.liked,
    sj.liked_at,
    sj.regen_reason,
    sj.regen_reason_text,
    sj.regen_to_job_id,
    sj.error_message
  from public.snap_jobs sj
  join auth.users u on u.id = sj.user_id
  left join public.naver_accounts na on na.user_id = sj.user_id
  where sj.kind = 'catalog'
    and (
      p_email is null
      or btrim(p_email) = ''
      or coalesce(na.email, u.email) ilike '%' || btrim(p_email) || '%'
    )
  order by sj.submitted_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

revoke execute on function public.admin_snap_jobs(text, integer, integer) from anon, authenticated;

comment on function public.admin_snap_jobs(text, integer, integer) is
  '운영자용 AI 웨딩스냅(catalog) 생성내역 + 반응(liked/재생성 사유) + 입력/결과 이미지 조회. 최신순, 이메일 필터, limit/offset 페이지네이션. service_role 전용.';
