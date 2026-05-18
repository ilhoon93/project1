-- 019_snap_jobs_auto_refund.sql
--
-- snap_jobs 실패 시 자동 환불 트리거.
--
-- 도입 이유:
--   현재는 application 코드에서 markSnapJobFailed 호출 후 refund_snap_credit
--   을 별도로 호출. 코드 경로에 따라 환불 누락이 발생할 수 있고 (예: 처리 도중
--   서버 크래시 / fal 응답 timeout 후 별도 cron 에서 status 만 'failed' 로
--   표시) 사용자 신뢰에 직결.
--
--   해결: snap_jobs 의 status 가 'failed' 또는 'timeout' 으로 전이될 때 DB
--   트리거가 자동으로 snap_credits_ledger 에 환불 행 추가. application 경로와
--   무관하게 일관성 보장.
--
-- 멱등성:
--   ref_id = snap_jobs.id 로 환불 행 식별. 같은 ref_id 로 이미 'refund' 행이
--   있으면 skip. status 가 failed → submitted → failed 같이 toggling 돼도
--   환불은 1회만.
--
-- credit_delta 처리:
--   - credit_delta = 0 (예: 무료 첫 activation, welcome 크레딧으로 소진된 경우):
--     환불할 게 없음 → skip
--   - credit_delta < 0 (실제 소모): -credit_delta 만큼 환불 (보통 1)
--   - credit_delta > 0: 정의 안 됨 — skip (방어적)
--
-- 트리거는 BEFORE 가 아닌 AFTER — 행 자체의 변경은 차단하지 않고 ledger 만 보강.

create or replace function public.snap_jobs_auto_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  refund_amount integer;
begin
  -- 'failed' / 'timeout' 으로의 전이만 처리. INSERT 케이스도 커버하기 위해
  -- TG_OP 별 OLD.status 처리. INSERT 면 OLD 가 null 이므로 별도 분기.
  if TG_OP = 'INSERT' then
    if NEW.status not in ('failed', 'timeout') then
      return NEW;
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.status not in ('failed', 'timeout') then
      return NEW;
    end if;
    -- 이미 실패 상태였다가 그대로면 아무것도 안 함 (status NOT NULL 가정).
    if OLD.status in ('failed', 'timeout') then
      return NEW;
    end if;
  else
    return NEW;
  end if;

  -- 소모된 크레딧이 없으면 환불할 게 없음.
  if NEW.credit_delta is null or NEW.credit_delta >= 0 then
    return NEW;
  end if;
  refund_amount := -NEW.credit_delta;

  -- 멱등성: 같은 ref_id 로 이미 환불됐으면 skip.
  if exists (
    select 1
      from public.snap_credits_ledger
     where reason = 'refund'
       and ref_table = 'snap_request'
       and ref_id = NEW.id
  ) then
    return NEW;
  end if;

  insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (
    NEW.user_id,
    refund_amount,
    'refund',
    'snap_request',
    NEW.id,
    'auto-refund: snap_jobs ' || NEW.fal_request_id || ' → ' || NEW.status
  );

  return NEW;
end;
$$;

drop trigger if exists snap_jobs_auto_refund_trg on public.snap_jobs;
create trigger snap_jobs_auto_refund_trg
  after insert or update of status on public.snap_jobs
  for each row
  execute function public.snap_jobs_auto_refund();

comment on function public.snap_jobs_auto_refund() is
  'snap_jobs.status 가 failed/timeout 으로 전이되면 자동으로 snap_credits_ledger 에 환불 행 추가. ref_id 로 멱등성 보장.';

-- ── 백필 — 트리거 도입 전 실패한 작업 중 환불 안 된 행 보전 ────
-- credit_delta < 0 이고 status in (failed, timeout) 이며 같은 ref_id 로 환불
-- 행이 없는 경우만. 한 번만 실행돼야 하므로 do block 안에서 처리.
do $$
declare
  rec record;
begin
  for rec in
    select j.id, j.user_id, j.fal_request_id, j.credit_delta, j.status
      from public.snap_jobs j
     where j.status in ('failed', 'timeout')
       and j.credit_delta < 0
       and not exists (
         select 1 from public.snap_credits_ledger l
          where l.reason = 'refund'
            and l.ref_table = 'snap_request'
            and l.ref_id = j.id
       )
  loop
    insert into public.snap_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (
      rec.user_id,
      -rec.credit_delta,
      'refund',
      'snap_request',
      rec.id,
      'backfill auto-refund: ' || rec.fal_request_id || ' → ' || rec.status
    );
  end loop;
end $$;
