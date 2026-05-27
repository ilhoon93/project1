-- 033_marketing_home_samples.sql
--
-- 메인(랜딩) 화면의 "샘플 AI스냅" 과 "샘플 알림장 디자인" 을 운영자가 세팅.
--
-- 단일 행 테이블 (id=true 강제). 값이 없으면 애플리케이션이 코드 기본값
-- (src/lib/marketing/sample-invitations.ts) 으로 폴백하므로, 행이 없어도 메인은
-- 정상 동작한다.
--
-- ── 컬럼 ──────────────────────────────────────────────────────
--   ai_snap_catalog_ids : 메인 노출 AI스냅 카탈로그 id 순서 목록.
--                         앞 4개 = Hero 폴라로이드, 전체 = AI 스냅 썸네일 스트립.
--                         (catalog.ts 의 SNAP_CATALOG[].id 와 같은 문자열, FK 없음)
--   designs             : 알림장 디자인 표지 설정 배열(JSON). 각 원소는
--                         { id, enabled, name, layoutLabel, colorTheme, petalType,
--                           font, layout, heroImageId, groomName, brideName,
--                           weddingDate, greetingShort }. 본문(스토리/갤러리 등)은
--                         공유 템플릿이라 저장하지 않음.
--
-- ── 권한 정책 (RLS) ───────────────────────────────────────────
--   읽기 : 누구나 (anon 포함) — 랜딩이 비로그인 공개 페이지이므로.
--   쓰기 : auth.jwt() app_metadata.role = 'admin' 인 사용자만. (028 패턴과 동일)

-- ═════════════════════════════════════════════════════════════
-- 1. 테이블 (단일 행)
-- ═════════════════════════════════════════════════════════════

create table if not exists public.marketing_home_samples (
  id boolean primary key default true check (id),
  ai_snap_catalog_ids text[] not null default '{}',
  designs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.marketing_home_samples is
  '랜딩 화면 샘플 설정(AI스냅 카탈로그 id 목록 + 알림장 디자인 표지 설정). 단일 행(id=true).';
comment on column public.marketing_home_samples.ai_snap_catalog_ids is
  '메인 노출 AI스냅 카탈로그 id 순서 목록. 앞 4개=Hero 폴라로이드, 전체=썸네일 스트립.';
comment on column public.marketing_home_samples.designs is
  '알림장 디자인 표지 설정 배열(JSON). 본문은 코드 공유 템플릿.';

-- ═════════════════════════════════════════════════════════════
-- 2. updated_at 자동 갱신 트리거
-- ═════════════════════════════════════════════════════════════

create or replace function public.marketing_home_samples_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_home_samples_touch_updated_at on public.marketing_home_samples;
create trigger marketing_home_samples_touch_updated_at
  before update on public.marketing_home_samples
  for each row
  execute function public.marketing_home_samples_touch_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 3. RLS
-- ═════════════════════════════════════════════════════════════

alter table public.marketing_home_samples enable row level security;

-- 읽기: 누구나 (비로그인 랜딩 포함).
drop policy if exists marketing_home_samples_select_all on public.marketing_home_samples;
create policy marketing_home_samples_select_all
  on public.marketing_home_samples
  for select
  to anon, authenticated
  using (true);

-- 쓰기 (insert/update/delete): admin role 만.
drop policy if exists marketing_home_samples_modify_admin on public.marketing_home_samples;
create policy marketing_home_samples_modify_admin
  on public.marketing_home_samples
  for all
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
