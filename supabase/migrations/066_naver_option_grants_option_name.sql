-- 066_naver_option_grants_option_name.sql
--
-- 커머스 API 가 이 스토어의 단독형 "패키지" 옵션을 optionCode 없이 productOption
-- 텍스트("패키지: 알림장 기본")로만 내려준다. → 옵션번호(option_code) 기반 매칭이
-- 항상 실패해 적립이 안 됐다.
--
-- 해결: 옵션명(option_name) 컬럼을 추가하고 판매자센터 옵션명으로 시드해,
-- 라우트가 productOption 텍스트로도 매칭할 수 있게 한다. (함수 시그니처는 그대로 —
-- 라우트가 옵션명으로 매칭 행을 찾아 그 행의 option_code 로 기존 grant RPC 호출.)
--
-- 컬럼 추가 + 시드만 하는 추가형 변경이라 재실행/배포 순서에 안전.

alter table public.naver_option_grants
  add column if not exists option_name text;

comment on column public.naver_option_grants.option_name is
  '판매자센터 옵션명(커머스 API productOption 텍스트 매칭용). 예: "알림장 기본".';

update public.naver_option_grants
   set option_name = case option_code
     when '58929908992' then '알림장 기본'
     when '58929908993' then '알림장 + 영구소장'
     when '58929908994' then '알림장 + AI 웨딩스냅 10+2장'
     when '58929916256' then '알림장 + 영구소장 & AI 웨딩스냅 5+1장'
     when '59246230104' then '알림장 1+1'
     when '59246230105' then '알림장 1+1 + 영구소장'
     else option_name
   end
 where product_no = '13622908142';
