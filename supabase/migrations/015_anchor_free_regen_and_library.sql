-- ============================================================
-- 015_anchor_free_regen_and_library.sql
--
-- 앵커 정책 확장:
--
-- 1) 무료 생성 횟수 2회로 확장
--    기존: snap_anchors.last_batch_at IS NULL 일 때만 1회 무료
--    신규: 별도 카운터 `free_full_batches_used` 추적 — 2회까지 무료
--          - 첫 batch (최초 생성) 무료
--          - 그 이후 재생성 1회도 무료
--          - 2회 모두 소진 후 재생성 = 4 스냅 크레딧
--
-- 2) 앵커 라이브러리 (snap_anchor_history 활용)
--    snap_anchor_history 가 폐기된 앵커뿐 아니라 "재생성으로 대체된" 과거
--    앵커도 자동 보존하도록 흐름 변경 (anchor/generate API 가 처리).
--    카탈로그 생성 시 사용자가 current 또는 library 의 과거 앵커 중 선택 가능.
--
--    스키마 자체는 변경 없음 — history table 은 14번 마이그레이션에서 이미 생성됨.
--    행 추가/조회 정책만 anchor/generate API 에서 새로 처리.
-- ============================================================

-- ── snap_anchors 에 무료 사용 카운터 추가 ────────────────
alter table public.snap_anchors
  add column if not exists free_full_batches_used integer not null default 0;

comment on column public.snap_anchors.free_full_batches_used is
  '소진된 무료 full-batch 횟수. 최대 2 (최초 생성 + 재생성 1회). 부분 재생성은 카운트 안 함.';

-- ── 기존 사용자 backfill ──────────────────────────────────
-- last_batch_at 이 NULL 이 아닌 사용자 = 이미 무료 활성화 1회 소진했음.
-- 그들에게는 아직 무료 재생성 1회 권리가 남아 있도록 1 로 세팅 (2 이하).
-- last_batch_at 이 NULL 인 사용자 = 아직 batch 만든 적 없음 → 0 유지.
update public.snap_anchors
   set free_full_batches_used = 1
 where last_batch_at is not null
   and free_full_batches_used = 0;

-- ── snap_anchor_history.id 노출 ──────────────────────────
-- API 가 history 의 특정 row 를 anchorId 로 받아 카탈로그 생성에 사용하므로
-- 이 id 가 클라이언트에 노출돼야 한다. RLS 가 user_id 매칭만 보장하면 안전.
-- (14번 마이그레이션에서 이미 select self 정책 있어 추가 변경 불필요)
