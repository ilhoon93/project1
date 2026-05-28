-- 034_marketing_home_samples_extras.sql
--
-- marketing_home_samples 에 두 컬럼 추가:
--   - before_after : 메인 AI스냅 Before/After 슬라이더 설정 (before 이미지 + 4 스타일)
--   - template     : 알림장 샘플 12종이 공유하는 본문(스토리/갤러리/퀴즈/투표/계좌/엔딩)
--
-- 두 필드 모두 nullable jsonb. 값이 없거나 파싱 실패 시 애플리케이션이 코드 기본값
-- (src/lib/marketing/sample-invitations.ts) 으로 안전 폴백한다.
-- 권한 정책은 033 의 RLS 가 그대로 적용 (읽기 anon 포함 / 쓰기 admin).

alter table public.marketing_home_samples
  add column if not exists before_after jsonb,
  add column if not exists template jsonb;

comment on column public.marketing_home_samples.before_after is
  '메인 AI스냅 Before/After 슬라이더 설정 (before 이미지 경로 + 스타일 4종).';
comment on column public.marketing_home_samples.template is
  '알림장 디자인 샘플들이 공유하는 본문(스토리/갤러리/퀴즈/투표/계좌/엔딩 등) 템플릿.';
