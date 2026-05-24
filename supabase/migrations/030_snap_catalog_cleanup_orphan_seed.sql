-- 030_snap_catalog_cleanup_orphan_seed.sql
--
-- migration 029 가 seed 한 hidden 행들 중, catalog.ts 에서 entry 자체가 삭제된
-- 10개 카탈로그의 row 를 cleanup. 코드와 DB 정합성 유지.
--
-- 영향 없는 동작: catalog.ts 에 entry 가 없는 catalog_id 는 어차피
-- findSnapCatalog 가 undefined 반환하고 SNAP_CATALOG.filter 에 안 나오므로
-- 사용자 페이지에 영향 X. 다만 orphan row 가 admin 페이지 / 분석 쿼리에 잡혀
-- 혼란을 줄 수 있어 정리.

delete from public.snap_catalog_tags
where catalog_id in (
  'studio-classic',
  'meadow-spring',
  'hanok-courtyard',
  'city-goldenhour',
  'beach-sunset',
  'bridge-goldenhour',
  'bride-bouquet',
  'groom-walk-away',
  'bride-veil-flow',
  'bride-window'
);
