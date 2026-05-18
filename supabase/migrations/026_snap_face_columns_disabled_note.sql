-- 026_snap_face_columns_disabled_note.sql
--
-- snap_jobs 의 face 관련 컬럼 코멘트 갱신 — 현재 비활성 상태 명시.
--
-- 배경:
--   fal 측에서 face-detection / face-similarity 류 모델 endpoint 가 제거된 상태
--   (2026-05 기준). `fal-ai/imageutils/face-detection` 호출 시 fal 서버가
--   `404 Path /face-detection not found` 반환. 공식 모델 카탈로그에서도 face
--   detection 모델 자체가 사라짐.
--
--   이에 따라 본 PR 에서 두 기능을 default 비활성화:
--     - SNAP_INPUT_VALIDATION_MODE default `strict` → `off`
--     - SNAP_FACE_SIMILARITY default `off` (신규 env)
--
--   대체 솔루션 (Google Vision / face-api.js / 다른 fal 모델) 도입 또는 fal 측
--   복구 후 두 env 를 켤 수 있음. 컬럼 자체는 schema 유지 — 미래 데이터 수집을
--   위한 자리는 그대로.
--
-- 기능 변경 없음 — COMMENT 만 갱신. idempotent (재실행 안전).

comment on column public.snap_jobs.input_face_count is
  '입력 사진의 검출된 얼굴 수 (fal face-detection).
   현재 ''couple'' 모드만 측정 — 앵커 모드(anchored)는 의도적으로 NULL
   (앵커 자체가 우리가 생성한 이미지라 face count = personality 로 거의 결정).
   2026-05 기준: fal 측 face-detection endpoint 제거로 default 비활성
   (SNAP_INPUT_VALIDATION_MODE=off). 대체 솔루션 도입 또는 fal 복구 후
   strict/permissive 로 켜야 채워짐.';

comment on column public.snap_jobs.input_face_min_size is
  '입력 사진 내 가장 작은 얼굴의 짧은 변 픽셀 수. 120 미만이면 face fidelity 저하 위험.
   input_face_count 와 동일하게 현재 ''couple'' 모드만 측정 — 앵커 모드는 NULL.
   2026-05 기준 fal face-detection 비활성 정책으로 default NULL.';

comment on column public.snap_jobs.input_avg_luminance is
  '입력 사진 평균 luminance 0..255. 야경/저조도 입력 (< 70) 에서 강한 backlight 카탈로그 조합 risk 분석용.
   sharp 로컬 계산 — fal face-detection 비활성 상태에서도 정상 측정됨.
   ''couple'' 모드만 채움 — 앵커 모드는 NULL.';

comment on column public.snap_jobs.face_similarity_groom is
  '신랑 얼굴 ArcFace cosine similarity. 0..1 (1=동일 인물, 0.5+=동일 판정 가능, <0.3=다른 사람).
   groom-solo / together 카탈로그에서 groomSelfie 가 있는 경우 채워짐.
   커플 모드는 fal 가 페어 단일 점수만 반환해 누가 매칭됐는지 구분 불가 → _groom 컬럼에만 저장
   (face_similarity_ref=''couple_input'' 으로 표시).
   2026-05 기준: fal 측 face-similarity 도 face-detection 과 같은 endpoint 제거 패턴으로
   추정되어 default 비활성 (SNAP_FACE_SIMILARITY=off). 켤 때 FAL_FACE_SIMILARITY_MODEL
   로 새 endpoint 지정 가능.';

comment on column public.snap_jobs.face_similarity_bride is
  '신부 얼굴 ArcFace cosine similarity. 0..1.
   bride-solo 카탈로그 또는 together 카탈로그에서 brideSelfie 가 있는 경우 채워짐.
   groom-solo / 커플 모드에서는 NULL.
   2026-05 기준 face_similarity_groom 과 동일하게 default 비활성.';

comment on column public.snap_jobs.face_similarity_ref is
  'similarity 측정 시 reference 이미지 종류:
     ''selfie''       = snap_anchors.groom/bride_selfie_url
     ''anchor''       = 앵커 이미지 (현재 미사용, 향후 확장)
     ''couple_input'' = 사용자 업로드 커플 사진 (couple_photo_url) — 단일 점수, _groom 컬럼에 저장.
   2026-05 기준 face_similarity 측정 자체 비활성이라 default NULL.';
