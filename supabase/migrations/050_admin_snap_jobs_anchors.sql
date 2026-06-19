-- 050_admin_snap_jobs_anchors.sql
--
-- admin_snap_jobs 확장:
--   1) 앵커 생성 잡(kind='anchor')도 포함 (기존 kind='catalog' 한정 제거).
--   2) 앵커 잡 식별용 anchor_slot / anchor_framing 반환.
--   3) 셀카 카탈로그가 "사용한 앵커"를 입력→앵커→결과로 보여줄 수 있도록
--      snap_anchors 의 groom_anchor_url / bride_anchor_url 도 반환.
--
-- 반환 컬럼이 늘어 시그니처가 바뀌므로 drop 후 재생성. (anchor 결과/앵커 URL 은
-- private-uploads signed 라 앱에서 재서명한다.)

drop function if exists public.admin_snap_jobs(text, integer, integer);

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
  anchor_slot       text,
  anchor_framing    text,
  status            text,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  result_url        text,
  couple_photo_url  text,
  couple_photo_path text,
  groom_selfie_url  text,
  bride_selfie_url  text,
  groom_anchor_url  text,
  bride_anchor_url  text,
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
    sj.anchor_slot,
    sj.anchor_framing,
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
    (select a.groom_anchor_url from public.snap_anchors a
       where a.user_id = sj.user_id limit 1) as groom_anchor_url,
    (select a.bride_anchor_url from public.snap_anchors a
       where a.user_id = sj.user_id limit 1) as bride_anchor_url,
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
  where (
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
  '운영자용 AI 웨딩스냅 생성내역(catalog+anchor) + 반응 + 입력/사용앵커/결과 이미지. 최신순, 이메일 필터, limit/offset. service_role 전용.';
