-- 037: marketing_home_samples 에 example_flow(jsonb) 컬럼 추가.
--
-- AI 스냅 '예시보기 팝업'(ExampleFlowModal — 셀카 3행 / 커플 2행 흐름) 의 이미지·
-- 카탈로그·텍스트를 운영자가 /admin/snap-samples 에서 세팅할 수 있게 한다.
-- null 이면 코드 기본값(DEFAULT_EXAMPLE_FLOW)으로 안전 폴백 — 공개 페이지가 깨지지 않음.
-- RLS 는 기존 정책(select 모두, 변경 admin 만) 을 그대로 따른다.

alter table public.marketing_home_samples
  add column if not exists example_flow jsonb;

comment on column public.marketing_home_samples.example_flow is
  'AI 스냅 예시보기 팝업(셀카 3행/커플 2행) 설정 — 이미지 URL·카탈로그 id·설명/라벨 텍스트. null = 코드 기본값(DEFAULT_EXAMPLE_FLOW).';
