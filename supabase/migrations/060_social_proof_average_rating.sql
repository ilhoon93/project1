-- 060_social_proof_average_rating.sql
--
-- 사회적 증거에 표시되는 "평균 별점"을 운영자가 직접 세팅할 수 있도록 컬럼 추가.
-- (기존에는 리뷰별 별점 평균으로 자동 계산했으나, 노출 값을 운영자가 지정.)
-- 0 이면 평점 타일 미노출. 기본 5.0.

alter table public.marketing_social_proof
  add column if not exists average_rating numeric(2,1) not null default 5.0;

comment on column public.marketing_social_proof.average_rating is
  '사회적 증거에 노출할 평균 별점(0~5). 0 이면 미노출.';
