-- 062_social_proof_showcase_covers.sql
--
-- 사회적 증거 "디자인 사진" 마퀴를 실제 고객 알림장 메인 디자인으로 채우기 위한
-- showcase 커버 스냅샷 저장 컬럼.
--
-- 각 커버는 캡처 이미지가 아니라 config 렌더 스냅샷이다:
--   { id, groomName, brideName, weddingDate, content }  (content = InvitationContent)
-- content.main.heroImage 에는 얼굴 위 스티커를 합성한 이미지 URL 을 넣어 두어,
-- 홈에서 InvitationPreview 로 실제 메인 화면 그대로(익명화된 상태) 렌더한다.
--
-- 기존 marketing_social_proof 단일 행에 컬럼만 추가 — get/save 인프라 그대로 사용.

alter table public.marketing_social_proof
  add column if not exists covers jsonb not null default '[]'::jsonb;

comment on column public.marketing_social_proof.covers is
  'showcase 커버 스냅샷 배열(JSON). 각 원소 { id, groomName, brideName, weddingDate, content }. content.main.heroImage 는 얼굴 스티커 합성본 URL.';
