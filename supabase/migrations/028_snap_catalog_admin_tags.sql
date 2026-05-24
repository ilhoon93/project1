-- 028_snap_catalog_admin_tags.sql
--
-- 카탈로그 × 입력 조건 별 운영자 수동 태그 테이블.
--
-- 기존에는 src/lib/snap/catalog-compatibility.ts 의 scoreCompatibility 함수가
-- (framing, hasSideAngle, isSeated, faceSizeRatio) 기반 휴리스틱으로 자동 등급
-- 판정 + prompt-only 권장을 결정했음. 운영하면서 자동 휴리스틱이 케이스별로
-- 부정확한 경우가 많아, 운영자가 카탈로그별로 직접 태그를 세팅할 수 있도록
-- 별도 테이블로 분리한다.
--
-- 우선순위: admin 테이블 > 자동 휴리스틱 (다음 PR 에서 휴리스틱 제거 예정).
--
-- ── 입력 조건 (input_condition) ────────────────────────────────
--   'selfies'         : 셀카로 만들기 모드 (1장 / 3장 동일하게 적용)
--   'couple-fullbody' : 커플 모드 + 입력 사진이 전신 (face size < 15%)
--   (커플 모드 + 얼굴 큰 입력은 어차피 모두 safe 라 별도 차원 불필요)
--
-- ── 태그 (tag) ────────────────────────────────────────────────
--   'recommend' : 추천 — 카드에 별 + 정렬 우선순위
--   'caution'   : 주의 — 작은 chip + prompt-only 자동 추천 banner
--   'risky'     : 비추 — 빨간 chip + prompt-only 강추
--   'hidden'    : picker / 미리보기에서 완전 숨김 (catalog.ts 의 hidden:true 와 동일 효과)
--
-- 한 (catalog_id, input_condition) 페어당 태그는 1개. 미설정 행이 없으면
-- "운영자가 평가 안 함" = default 동작 (다음 PR 에서 자동 휴리스틱 제거 후엔
-- "safe" 로 폴백). catalog_id 는 catalog.ts 의 SNAP_CATALOG[].id 와 같은
-- 문자열로 저장하며 별도 FK 두지 않음 (카탈로그 정의가 코드라서).
--
-- ── 권한 정책 (RLS) ───────────────────────────────────────────
-- 읽기   : authenticated 모두 (사용자 페이지에서 호환성 판정에 사용해야 하므로)
-- 쓰기   : auth.jwt() ->> 'role' = 'admin' 인 사용자만 (supabase auth user 의
--           app_metadata.role = 'admin' 으로 부여)
--           운영자 권한 부여 방법:
--             update auth.users
--             set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--             where email = 'admin@example.com';

-- ═════════════════════════════════════════════════════════════
-- 1. 테이블
-- ═════════════════════════════════════════════════════════════

create table if not exists public.snap_catalog_tags (
  catalog_id text not null,
  input_condition text not null
    check (input_condition in ('selfies', 'couple-fullbody')),
  tag text not null
    check (tag in ('recommend', 'caution', 'risky', 'hidden')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (catalog_id, input_condition)
);

comment on table public.snap_catalog_tags is
  '카탈로그 × 입력 조건 별 운영자 수동 태그. admin 페이지에서 관리.';
comment on column public.snap_catalog_tags.catalog_id is
  'src/lib/snap/catalog.ts 의 SNAP_CATALOG[].id 와 같은 문자열. FK 없음 (코드 source-of-truth).';
comment on column public.snap_catalog_tags.input_condition is
  '''selfies'' = 셀카 모드, ''couple-fullbody'' = 커플 모드 + 전신 입력.';
comment on column public.snap_catalog_tags.tag is
  '''recommend'' / ''caution'' / ''risky'' / ''hidden''. 미설정 행은 default 동작.';

-- ═════════════════════════════════════════════════════════════
-- 2. updated_at 자동 갱신 트리거
-- ═════════════════════════════════════════════════════════════

create or replace function public.snap_catalog_tags_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists snap_catalog_tags_touch_updated_at on public.snap_catalog_tags;
create trigger snap_catalog_tags_touch_updated_at
  before update on public.snap_catalog_tags
  for each row
  execute function public.snap_catalog_tags_touch_updated_at();

-- ═════════════════════════════════════════════════════════════
-- 3. RLS
-- ═════════════════════════════════════════════════════════════

alter table public.snap_catalog_tags enable row level security;

-- 읽기: 인증된 사용자 모두.
drop policy if exists snap_catalog_tags_select_authenticated on public.snap_catalog_tags;
create policy snap_catalog_tags_select_authenticated
  on public.snap_catalog_tags
  for select
  to authenticated
  using (true);

-- 쓰기 (insert/update/delete): admin role 만.
drop policy if exists snap_catalog_tags_modify_admin on public.snap_catalog_tags;
create policy snap_catalog_tags_modify_admin
  on public.snap_catalog_tags
  for all
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
