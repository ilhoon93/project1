-- 027_snap_drop_face_columns.sql
--
-- snap_jobs 에서 face 관련 컬럼 영구 삭제.
--
-- 배경:
--   fal 측에서 face-detection / face-similarity 모델 endpoint 가 카탈로그에서
--   완전히 제거된 상태 (2026-05 확인). 대체 솔루션 도입 전까지 기능 자체를
--   비활성화하기로 결정. 컬럼은 모두 NULL 만 들어있는 상태라 데이터 손실 없음.
--
-- 삭제 대상:
--   - input_face_count        (fal face-detection 결과)
--   - input_face_min_size     (fal face-detection 결과)
--   - input_avg_luminance     (sharp 로컬 계산이지만 input_face_* 와 함께 다닌
--                              "입력 메타" 트리플의 일부 — 단독으로 의미 약해 동반 삭제)
--   - face_similarity_groom   (fal face-similarity 결과)
--   - face_similarity_bride   (fal face-similarity 결과)
--   - face_similarity_ref     (fal face-similarity 결과)
--
-- 컬럼 COMMENT 도 컬럼과 함께 자동 사라짐. 마이그 024 / 026 의 해당 컬럼
-- COMMENT 진술은 이미 적용된 후 무효화됨 (재실행 안 함).
--
-- 향후 대체 솔루션 도입 시 새 마이그로 컬럼 재추가 가능.

alter table public.snap_jobs
  drop column if exists input_face_count,
  drop column if exists input_face_min_size,
  drop column if exists input_avg_luminance,
  drop column if exists face_similarity_groom,
  drop column if exists face_similarity_bride,
  drop column if exists face_similarity_ref;
