-- ============================================================
-- 006_ai_usage.sql
--
--   AI 메인 이미지 — 사용자(네이버 계정) 1명당 1회 무료 생성 제한.
--
--   기존 content.main.aiUsed 는 청첩장 1건 단위였는데, 사용자가 청첩장을
--   여러 개 만들면 매번 1회씩 사용할 수 있어 무료 한도가 의미를 잃는다.
--   이 테이블은 user_id 단위로 last_used_at + count 를 추적해 진짜로
--   계정당 1회 제한을 강제한다.
--
--   API 라우트(/api/ai/free-preview) 가 service-role 클라이언트로 INSERT
--   ON CONFLICT 하므로 RLS 는 service-role 만 통과시키도록 잠가둔다.
-- ============================================================

create table if not exists public.ai_image_usage (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  used_count   integer not null default 0,
  last_used_at timestamptz not null default now(),
  -- 가장 최근 생성 결과의 storage 경로(public-images). 결과 다시보기/다운로드용.
  last_image_path text
);

alter table public.ai_image_usage enable row level security;

-- 일반 사용자는 자기 행만 select 할 수 있게 — UI 에서 잔여 횟수 표시용.
create policy "ai_image_usage select self"
  on public.ai_image_usage
  for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE 는 service-role(API 라우트) 가 admin 클라이언트로만 수행.
-- (별도 policy 없으면 service-role 은 RLS 를 우회하므로 그대로 가능.)
