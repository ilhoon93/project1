-- ============================================================
-- 036_marketing_home_samples_owner_url.sql
--
-- marketing_home_samples 에 owner_url_example 컬럼 추가.
-- 메인(/) ShowcaseTabs "소장용 URL" 모달의 "예시 열기" 버튼이 가리키는 실 URL.
-- 관리자(/admin/home-samples) 가 실제 발행한 알림장의 owner URL 을 입력 → 사용자가
-- 모달에서 클릭하면 새 창으로 열린다. 비어 있으면 모달에 placeholder URL 만 표시
-- 되고 "예시 열기" 버튼은 노출되지 않는다.
--
-- 단일 행(id=true) jsonb 다 컬럼 구조를 유지하되, 별도 text 컬럼으로 분리 — 의미상
-- "특정 알림장 URL" 한 줄이라 jsonb 안에 넣는 것보다 컬럼이 깔끔.
-- 기존 데이터 무영향(nullable, default '').
-- ============================================================

alter table public.marketing_home_samples
  add column if not exists owner_url_example text not null default '';

comment on column public.marketing_home_samples.owner_url_example is
  '메인 ShowcaseTabs "소장용 URL" 모달이 가리키는 실 예시 owner URL. 빈 문자열이면 placeholder 사용.';
