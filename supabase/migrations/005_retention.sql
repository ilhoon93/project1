-- ============================================================
-- 005_retention.sql — 자동 정리 정책
--
-- 미발행 상태로 14일 이상 수정이 없는 알림장은 자동 삭제한다.
-- (한 번이라도 발행되었던 알림장은 publications 행의 만료일까지
-- 보호되므로 이 함수의 대상이 아님 — 발행 후 30일이 지나면 별도
-- 만료 처리에서 다룬다.)
--
-- 호출 경로:
--   1) Vercel Cron 또는 외부 스케줄러 → /api/cron/cleanup-drafts (CRON_SECRET 헤더)
--   2) Supabase pg_cron 으로 daily 호출 (선택)
-- ============================================================

create or replace function public.cleanup_stale_drafts(ttl_days int default 14)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  with deleted as (
    delete from public.invitations
     where is_published = false
       and updated_at < now() - make_interval(days => ttl_days)
       -- 안전망: 결제까지 진행한 흔적이 남아 있으면 삭제하지 않는다
       -- (사용자가 결제는 했는데 발행 직전 이탈한 케이스)
       and paid_at is null
       and payment_id is null
     returning 1
  )
  select count(*) into removed from deleted;
  return removed;
end;
$$;

comment on function public.cleanup_stale_drafts(int) is
  '미발행 상태로 N일 이상 수정 없는 draft 알림장을 일괄 삭제. 삭제 건수 반환.';
