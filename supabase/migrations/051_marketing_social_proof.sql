-- 051_marketing_social_proof.sql
--
-- 메인(랜딩) "알림장 소개" 섹션 하단에 넣을 사회적 증거(리뷰 이미지 + 커플 수 등)
-- 설정을 운영자가 세팅. 033(marketing_home_samples) 과 동일한 단일 행 + RLS 패턴.
--
-- 값이 없으면 애플리케이션이 코드 기본값(src/lib/marketing/social-proof.ts)으로
-- 폴백한다. 현재는 관리자에서 세팅만 하고 실제 메인 렌더는 아직 연결하지 않는다
-- (enabled 기본 false).
--
-- ── 컬럼 ──────────────────────────────────────────────────────
--   enabled              : 메인 노출 여부(추후 랜딩 연결 시 사용). 기본 false.
--   heading / subheading : 섹션 제목/부제.
--   couple_count         : 강조할 커플 수(정수).
--   couple_count_suffix  : 커플 수 단위(예: '쌍').
--   couple_count_caption : 커플 수 아래 보조 문구.
--   reviews              : 리뷰 이미지 배열(JSON). 각 원소 { id, imageUrl, caption }.
--
-- ── 권한 정책 (RLS) ───────────────────────────────────────────
--   읽기 : 누구나 (anon 포함) — 랜딩이 비로그인 공개 페이지이므로.
--   쓰기 : app_metadata.role = 'admin' 만.

create table if not exists public.marketing_social_proof (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  heading text not null default '',
  subheading text not null default '',
  couple_count integer not null default 0,
  couple_count_suffix text not null default '쌍',
  couple_count_caption text not null default '',
  reviews jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.marketing_social_proof is
  '랜딩 알림장 섹션 사회적 증거 설정(리뷰 이미지 + 커플 수 등). 단일 행(id=true).';
comment on column public.marketing_social_proof.enabled is
  '메인 노출 여부. 현재는 관리자 세팅만 하고 랜딩 렌더는 미연결(기본 false).';
comment on column public.marketing_social_proof.reviews is
  '리뷰 이미지 배열(JSON). 각 원소 { id, imageUrl, caption }.';

-- updated_at 자동 갱신 트리거
create or replace function public.marketing_social_proof_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_social_proof_touch_updated_at on public.marketing_social_proof;
create trigger marketing_social_proof_touch_updated_at
  before update on public.marketing_social_proof
  for each row
  execute function public.marketing_social_proof_touch_updated_at();

-- RLS
alter table public.marketing_social_proof enable row level security;

drop policy if exists marketing_social_proof_select_all on public.marketing_social_proof;
create policy marketing_social_proof_select_all
  on public.marketing_social_proof
  for select
  to anon, authenticated
  using (true);

drop policy if exists marketing_social_proof_modify_admin on public.marketing_social_proof;
create policy marketing_social_proof_modify_admin
  on public.marketing_social_proof
  for all
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
