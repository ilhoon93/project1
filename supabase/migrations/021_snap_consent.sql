-- 021_snap_consent.sql
--
-- 스냅 사용 동의 기록 — 한국 개인정보보호법 / 정보통신망법 대응.
--
-- 안면 인식 정보 + AI 합성 + (옵션) 외부 채널 배포까지 묶이면 별도 동의 필수.
-- 동의 버전을 명시적으로 관리해 약관이 바뀔 때 사용자에게 재동의 요청 가능.
--
-- 컬럼:
--   * version       : 동의 버전 — 약관 본문 변경 시 increment
--   * accepted_at   : 동의 시점
--   * scope         : 'personal_info' (필수, 얼굴 등 PII 처리)
--                   | 'ai_generation' (필수, AI 합성)
--                   | 'external_share' (선택, 외부 채널 배포)
--   * user_agent    : 동의 시점 user-agent 기록 (감사 추적)
--   * ip_address    : 동의 시점 IP (감사 추적, 보존 기간 한정)
--
-- 멀티 동의: 같은 user_id + scope 의 가장 최신 row 가 현재 동의 상태.
-- 철회 시 새 row 를 accepted=false 로 insert.

create table if not exists public.snap_consent (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null check (scope in ('personal_info', 'ai_generation', 'external_share')),
  version     integer not null,
  accepted    boolean not null default true,
  accepted_at timestamptz not null default now(),
  user_agent  text,
  ip_address  inet
);

create index if not exists idx_snap_consent_user_scope
  on public.snap_consent (user_id, scope, accepted_at desc);

alter table public.snap_consent enable row level security;

-- 사용자는 자기 동의 row 만 read 가능.
drop policy if exists "snap_consent select self" on public.snap_consent;
create policy "snap_consent select self"
  on public.snap_consent for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT 는 service role 만 — application 이 검증 후 admin client 로 기록.
-- (auth 사용자 직접 insert 차단해 위변조 방지.)

-- 헬퍼: 사용자의 현재 동의 상태 (필수 scope 모두 accept 인지) 반환.
create or replace function public.snap_has_required_consent(p_user_id uuid, p_version integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select bool_and(latest.accepted)
        from (
          select distinct on (scope)
            scope, accepted, version
            from public.snap_consent
           where user_id = p_user_id
             and scope in ('personal_info', 'ai_generation')
           order by scope, accepted_at desc
        ) latest
       where latest.version >= p_version
    ), false);
$$;

comment on table public.snap_consent is
  '스냅 PII / AI 합성 / 외부 공유 동의 기록. scope 별로 가장 최신 row 가 현재 상태.';
comment on function public.snap_has_required_consent is
  '필수 scope(personal_info, ai_generation) 모두 지정 version 이상으로 accepted=true 인지 확인.';
