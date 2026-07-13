-- 055_naver_option_grants_1plus1.sql
--
-- 알림장 상품(13622908142)에 신규 옵션 2종 추가 — "1+1" 계열.
-- 041 시드와 동일한 (상품번호, 옵션코드) → 크레딧 매핑. on conflict upsert 로
-- 재실행/수량 조정에도 안전.
--
-- 지급 정책(운영자 확정):
--   59246230104 알림장 1+1          : 발행권 2 (알림장 2개분)
--   59246230105 알림장 1+1 + 영구소장 : 발행권 2 + 영구소장권 2 (두 건 모두 영구소장)

insert into public.naver_option_grants
  (product_no, option_code, label, publish_grant, archive_grant, snap_grant, regen_grant)
values
  ('13622908142', '59246230104', '알림장 1+1',              2, 0, 0, 0),
  ('13622908142', '59246230105', '알림장 1+1 + 영구소장',    2, 2, 0, 0)
on conflict (product_no, option_code) do update
  set label         = excluded.label,
      publish_grant = excluded.publish_grant,
      archive_grant = excluded.archive_grant,
      snap_grant    = excluded.snap_grant,
      regen_grant   = excluded.regen_grant,
      active        = true;
