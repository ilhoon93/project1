-- 025_snap_image_reference.sql
--
-- snap_jobs 에 image_reference 컬럼 추가 + 일부 기존 컬럼 COMMENT 보강.
--
-- ── image_reference ─────────────────────────────────────────
-- /api/snap/generate 에서 수신만 하고 DB 에는 안 들어가던 합성 방식 선택값을
-- snap_jobs 에 기록하기 위한 컬럼. UI 의 "구도 우선 / 유사도 우선" (셀카 모드)
-- 또는 "카탈로그 충실 / 얼굴 보존" (커플 모드) 토글이 어떤 값으로 생성됐는지
-- 사후 분석에 사용.
--
-- check 제약으로 'strict' / 'prompt-only' 만 허용. NULL 도 허용해서 anchor kind
-- 행과 image_reference 미지정 케이스에 영향 없음.
--
-- ── COMMENT 갱신 ─────────────────────────────────────────────
-- PR #129 (face_similarity_bride 활성화) / fal_cost_usd 의 quality 별 baseline 분기
-- (본 마이그와 같은 PR 의 finalize.ts 변경) / input_face_* 의 실제 측정 범위
-- (커플 모드만) 등을 컬럼 도움말에 정확히 반영.
--
-- 모두 idempotent — `add column if not exists`, `comment on column` 재실행 안전.

-- ═════════════════════════════════════════════════════════════
-- 1. image_reference 컬럼 추가
-- ═════════════════════════════════════════════════════════════

alter table public.snap_jobs
  add column if not exists image_reference text
    check (image_reference in ('strict', 'prompt-only') or image_reference is null);

comment on column public.snap_jobs.image_reference is
  '''catalog'' kind 한정. UI 토글이 어느 합성 방식으로 생성했는지 기록:
     ''strict''      = 카탈로그 마스터 이미지를 fal 입력에 포함. 의상/배경/구도 충실.
     ''prompt-only'' = 마스터 이미지 제외, 텍스트로만 scene 지시. 얼굴 보존 우선.
   anchor kind 또는 미지정 케이스는 NULL.
   사용자 UI 라벨 — 셀카 모드: ''구도 우선'' / ''유사도 우선'',
                    커플 모드: ''카탈로그 충실'' / ''얼굴 보존''.';

-- ═════════════════════════════════════════════════════════════
-- 2. 기존 컬럼 COMMENT 갱신 (실제 측정 범위 / 분기 반영)
-- ═════════════════════════════════════════════════════════════

-- input_face_* : 현재 커플 모드에서만 측정. 앵커 모드는 의도적으로 NULL.
comment on column public.snap_jobs.input_face_count is
  '입력 사진의 검출된 얼굴 수 (fal face-detection).
   현재 ''couple'' catalog_path 에서만 측정 — 앵커 모드(anchored)는 의도적으로 NULL
   (앵커 자체가 우리가 생성한 이미지라 face count = personality 로 거의 결정).
   커플 모드에서 2 가 아니면 사용자에게 사전 경고 후 차단.';

comment on column public.snap_jobs.input_face_min_size is
  '입력 사진 내 가장 작은 얼굴의 짧은 변 픽셀 수. 120 미만이면 face fidelity 저하 위험.
   input_face_count 와 동일하게 현재 ''couple'' 모드만 측정 — 앵커 모드는 NULL.';

comment on column public.snap_jobs.input_avg_luminance is
  '입력 사진 평균 luminance 0..255. 야경/저조도 입력 (< 70) 에서 강한 backlight 카탈로그 조합 risk 분석용.
   input_face_count 와 동일하게 현재 ''couple'' 모드만 측정 — 앵커 모드는 NULL.';

-- fal_cost_usd : quality 별 baseline 분기 (low/medium/high/auto 다른 추정치)
comment on column public.snap_jobs.fal_cost_usd is
  '추정 fal 비용 USD. numeric(8,4) 0.0001 단위.
   gpt-image-2 baseline 은 snap_jobs.quality 기준 분기:
     low ≈ $0.01, medium ≈ $0.04, high ≈ $0.13, auto ≈ $0.08.
   여기에 활성화된 후처리 단계 (face-swap, birefnet, flux img2img, upscale) 비용 가산.
   COST_ESTIMATES_USD 상수 기반 — 실제 청구와 ±10% 차이 가능.';

-- face_similarity_bride : PR #129 이후로 together 케이스에서 적극 채워짐
comment on column public.snap_jobs.face_similarity_bride is
  '신부 얼굴 ArcFace cosine similarity. 0..1.
   bride-solo 카탈로그 또는 together 카탈로그에서 brideSelfie 가 있는 경우 채워짐.
   groom-solo / 커플 모드에서는 NULL (커플 모드는 _groom 컬럼에만 단일 점수 저장).
   measurement 자체가 실패하면 NULL.';

comment on column public.snap_jobs.face_similarity_groom is
  '신랑 얼굴 ArcFace cosine similarity. 0..1 (1=동일 인물, 0.5+=동일 판정 가능, <0.3=다른 사람).
   groom-solo / together 카탈로그에서 groomSelfie 가 있는 경우 채워짐.
   커플 모드는 fal 가 페어 단일 점수만 반환해 누가 매칭됐는지 구분 불가 → _groom 컬럼에만 저장
   (face_similarity_ref=''couple_input'' 으로 표시).
   finalize 단계 await 측정 → 실패 시 NULL. 자동 환불 X (분석용).';

comment on column public.snap_jobs.face_similarity_ref is
  'similarity 측정 시 reference 이미지 종류:
     ''selfie''       = snap_anchors.groom/bride_selfie_url
     ''anchor''       = 앵커 이미지 (현재 미사용, 향후 확장)
     ''couple_input'' = 사용자 업로드 커플 사진 (couple_photo_url) — 단일 점수, _groom 컬럼에 저장.';
