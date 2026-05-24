-- 029_snap_catalog_seed_hidden_tags.sql
--
-- src/lib/snap/catalog.ts 의 hidden:true 항목 (마스터 미업로드 / 삭제됨) 을
-- snap_catalog_tags 에 'hidden' 태그로 자동 등록.
-- 두 input_condition (selfies + couple-fullbody) 양쪽 모두 hidden 으로 박아
-- picker 어느 모드에서도 노출 안 되도록.
--
-- 운영자가 admin 페이지에서 이 항목들의 태그를 다른 값으로 바꾸면 그쪽이 우선.
-- on conflict do nothing — 이미 운영자가 명시적으로 변경한 행은 건드리지 않음.
--
-- catalog.ts 의 hidden:true 필드는 그대로 유지 (legacy safety net) — 다음 PR
-- 에서 점진적으로 제거 가능.

insert into public.snap_catalog_tags (catalog_id, input_condition, tag) values
  -- 마스터 이미지 미업로드 (catalog.ts 정의는 있으나 jpg 없음)
  ('studio-classic',    'selfies',         'hidden'),
  ('studio-classic',    'couple-fullbody', 'hidden'),
  ('hanok-courtyard',   'selfies',         'hidden'),
  ('hanok-courtyard',   'couple-fullbody', 'hidden'),
  ('city-goldenhour',   'selfies',         'hidden'),
  ('city-goldenhour',   'couple-fullbody', 'hidden'),
  ('beach-sunset',      'selfies',         'hidden'),
  ('beach-sunset',      'couple-fullbody', 'hidden'),
  ('groom-walk-away',   'selfies',         'hidden'),
  ('groom-walk-away',   'couple-fullbody', 'hidden'),
  ('bride-veil-flow',   'selfies',         'hidden'),
  ('bride-veil-flow',   'couple-fullbody', 'hidden'),
  ('bride-window',      'selfies',         'hidden'),
  ('bride-window',      'couple-fullbody', 'hidden'),
  -- 마스터 이미지 삭제됨 (사용자 후속 PR 에서 정리)
  ('meadow-spring',     'selfies',         'hidden'),
  ('meadow-spring',     'couple-fullbody', 'hidden'),
  ('bridge-goldenhour', 'selfies',         'hidden'),
  ('bridge-goldenhour', 'couple-fullbody', 'hidden'),
  ('bride-bouquet',     'selfies',         'hidden'),
  ('bride-bouquet',     'couple-fullbody', 'hidden')
on conflict (catalog_id, input_condition) do nothing;
