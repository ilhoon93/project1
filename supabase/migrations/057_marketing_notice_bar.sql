-- 057_marketing_notice_bar.sql
--
-- 홈(마케팅) 상단 공지바 설정 — 운영자가 문구/링크/노출 여부를 세팅.
-- 033/051 과 동일한 단일 행 + RLS 패턴. 기본 enabled=false(비노출).
--
-- ── 컬럼 ──
--   enabled     : 노출 여부(기본 false).
--   message     : 공지 문구.
--   link_url    : (선택) 클릭 시 이동 URL.
--   link_label  : (선택) 링크 버튼 라벨.

create table if not exists public.marketing_notice_bar (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  message text not null default '',
  link_url text not null default '',
  link_label text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.marketing_notice_bar is
  '홈 상단 공지바 설정(문구/링크/노출 여부). 단일 행(id=true).';

create or replace function public.marketing_notice_bar_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_notice_bar_touch_updated_at on public.marketing_notice_bar;
create trigger marketing_notice_bar_touch_updated_at
  before update on public.marketing_notice_bar
  for each row
  execute function public.marketing_notice_bar_touch_updated_at();

alter table public.marketing_notice_bar enable row level security;

drop policy if exists marketing_notice_bar_select_all on public.marketing_notice_bar;
create policy marketing_notice_bar_select_all
  on public.marketing_notice_bar
  for select
  to anon, authenticated
  using (true);

drop policy if exists marketing_notice_bar_modify_admin on public.marketing_notice_bar;
create policy marketing_notice_bar_modify_admin
  on public.marketing_notice_bar
  for all
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
