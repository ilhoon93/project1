-- ============================================================
-- 014_snap_anchor_history.sql
--
-- 폐기된 앵커를 보존해 마이페이지에서 모아 볼 수 있도록 별도 history
-- 테이블 신설. snap_anchors 의 DELETE 흐름이 history 로 복사 후 삭제.
--
-- snap_anchors 는 user_id PK 라 한 row 만 유지. snap_anchor_history 는
-- id PK 로 여러 폐기 row 보관 가능 — 사용자가 anchor 를 여러 번 폐기/재
-- 생성해도 모두 기록.
-- ============================================================

create table if not exists public.snap_anchor_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- snap_anchors 에서 복사된 URL 들. 둘 다 NULL 일 수도 (선택 안 한 채 폐기된 경우).
  groom_anchor_url  text,
  bride_anchor_url  text,
  source_mode       text not null check (source_mode in ('selfies','couple')),
  groom_height_cm   integer,
  groom_weight_kg   integer,
  bride_height_cm   integer,
  bride_weight_kg   integer,
  -- 원래 snap_anchors 의 created_at (anchor 가 만들어진 시점).
  anchor_created_at timestamptz,
  -- 폐기된 시각.
  discarded_at      timestamptz not null default now()
);

create index if not exists idx_snap_anchor_history_user_time
  on public.snap_anchor_history (user_id, discarded_at desc);

alter table public.snap_anchor_history enable row level security;

drop policy if exists "snap_anchor_history select self" on public.snap_anchor_history;
create policy "snap_anchor_history select self"
  on public.snap_anchor_history for select
  using (auth.uid() = user_id);
-- INSERT 는 service-role 에서만 (anchor delete API 가 처리).
