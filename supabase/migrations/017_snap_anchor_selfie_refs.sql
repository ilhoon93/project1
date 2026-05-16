-- ============================================================
-- 017_snap_anchor_selfie_refs.sql
--
-- Identity drift 개선 (PR Phase A):
--   카탈로그 생성 시 anchor 만 reference 로 쓰면 selfie → anchor → catalog 의
--   2단계 AI 합성으로 인해 누적 identity loss 가 발생. 원본 셀카를 catalog 단계
--   입력에 함께 넣어 face identity 의 진본 reference 를 항상 동반시킨다.
--
-- 변경:
--   1) snap_anchors 에 groom_selfie_url / bride_selfie_url 컬럼 추가.
--      값은 anchor 생성 시 preprocess 결과(public-images 영구 URL) 의 첫 번째
--      (정면) 사진을 저장. 카탈로그 생성 시 anchor 옆에 함께 fal 에 전달.
--   2) snap_anchor_history 도 동일 컬럼 추가 — 라이브러리 anchor 에서도
--      과거 selfie 가 살아있어야 카탈로그 생성에 사용 가능.
--
-- 기존 데이터: 컬럼은 NULL 로 시작. /api/snap/generate 가 NULL 이면 자동으로
-- anchor 만 쓰는 fallback 분기 — 기존 사용자도 동작은 유지, 새 batch 이후
-- 개선 효과가 적용됨.
-- ============================================================

alter table public.snap_anchors
  add column if not exists groom_selfie_url text,
  add column if not exists bride_selfie_url text;

comment on column public.snap_anchors.groom_selfie_url is
  '신랑 대표 셀카 (preprocess 후 public-images 영구 URL). 카탈로그 생성 시 anchor 와 함께 fal 에 face identity reference 로 전달.';
comment on column public.snap_anchors.bride_selfie_url is
  '신부 대표 셀카 (preprocess 후 public-images 영구 URL).';

alter table public.snap_anchor_history
  add column if not exists groom_selfie_url text,
  add column if not exists bride_selfie_url text;
