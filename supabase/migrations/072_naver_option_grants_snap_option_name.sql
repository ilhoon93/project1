-- 072_naver_option_grants_snap_option_name.sql
--
-- 버그: 웨딩스냅 주문번호(예: "크레딧: 20장 + 재생성 무료 4장")를 마이페이지에서
--   등록하면 "등록되지 않은 상품 옵션입니다" 로 실패한다.
--
-- 원인: 이 스토어의 단일선택 옵션은 커머스 API 가 optionCode 없이 productOption
--   텍스트로만 내려주는 경우가 있어, orders/register 라우트는 option_name 으로
--   폴백 매칭을 한다. 그런데 066 은 이 option_name 을 알림장 상품(13622908142)
--   에만 시드하고 웨딩스냅 상품(13625481834)은 누락했다 → 코드도 이름도 못 맞춰
--   매핑 실패.
--
-- 수정: 066 과 동일한 방식으로 웨딩스냅 상품의 option_name 을 판매자센터 표기
--   (그룹명 "크레딧:" 접두 제거 후 값)로 시드한다. orders/register 의
--   extractOptionName 이 "크레딧: 20장 + 재생성 무료 4장" → "20장 + 재생성 무료 4장"
--   으로 잘라 비교하므로, option_name 도 접두 없는 값으로 맞춘다.
--
-- 참고: snap_grant / regen_grant 는 041 시드 그대로(5→1, 10→2, 20→4, 40→8).
--   여기서는 매칭용 option_name 만 채운다. 옵션명이 판매자센터 표기와 다르면
--   해당 옵션만 이름 매칭이 안 될 뿐(코드 매칭으로 폴백) 다른 옵션엔 영향 없음.

update public.naver_option_grants
   set option_name = case option_code
     when '58930649889' then '5장 + 재생성 무료 1장'
     when '58930649890' then '10장 + 재생성 무료 2장'
     when '58930649891' then '20장 + 재생성 무료 4장'
     when '58935754996' then '40장 + 재생성 무료 8장'
     else option_name
   end
 where product_no = '13625481834';
