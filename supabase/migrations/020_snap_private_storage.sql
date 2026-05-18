-- 020_snap_private_storage.sql
--
-- 개인 식별 가능 정보(PII) 인 셀카·커플 사진·앵커 결과·preprocessed·ephemeral
-- 을 private-uploads 버킷으로 격리.
--
-- 이 마이그레이션의 범위:
--   1) private-uploads 버킷 존재 보장 (public=false)
--   2) RLS 정책: 사용자는 자신의 user_id prefix 가 있는 경로만 read/write
--      서비스 롤(admin client) 은 모든 작업 가능
--   3) public-images 의 기존 wedding-snap/ 경로 RLS 강화 (결과 이미지는 공개
--      유지지만 anchor/preprocessed/ephemeral 경로는 새 업로드 차단해서 실수
--      방지)
--
-- 이 마이그레이션이 안 하는 것:
--   - 기존 public-images 안의 PII 파일을 private-uploads 로 물리적 이동.
--     Supabase 는 SQL 로 storage 객체 bucket 변경 시 underlying object key 가
--     깨지므로 별도 스크립트가 필요.
--     → scripts/migrate-snap-to-private.mjs 로 분리. README 에 실행 가이드 추가.
--
-- 호환성:
--   - 기존 public-images 에 있는 anchor URL 들은 그대로 동작 (DB 의 URL 유지).
--     사용자 영향 0.
--   - 새 업로드는 private-uploads 로 가서 signed URL 로 노출.
--   - 마이그레이션 스크립트 실행 후 모든 URL 이 signed URL 로 통일.

-- ── 1. private-uploads 버킷 보장 ──────────────────────────────
-- 이미 존재할 가능성이 높지만 멱등하게 작성.
insert into storage.buckets (id, name, public)
values ('private-uploads', 'private-uploads', false)
on conflict (id) do update set public = false;

-- ── 2. RLS 정책 — 사용자 자신의 prefix 만 접근 ───────────────
-- 경로 컨벤션: {user_id}/<rest>   또는   wedding-snap/{user_id}/<rest>
-- 두 가지 prefix 모두 매칭. service role 은 RLS bypass.

-- 기존 정책 정리.
drop policy if exists "private-uploads select own" on storage.objects;
drop policy if exists "private-uploads insert own" on storage.objects;
drop policy if exists "private-uploads update own" on storage.objects;
drop policy if exists "private-uploads delete own" on storage.objects;

-- SELECT — 자신의 prefix 만 읽기 가능.
create policy "private-uploads select own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'private-uploads' and (
      -- {user_id}/... 패턴
      (storage.foldername(name))[1] = auth.uid()::text
      -- wedding-snap/{user_id}/... 패턴
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- INSERT — 자신의 prefix 에만 업로드 가능.
create policy "private-uploads insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- UPDATE — 자신의 prefix 만.
create policy "private-uploads update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- DELETE — 자신의 prefix 만.
create policy "private-uploads delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

comment on policy "private-uploads select own" on storage.objects is
  '사용자는 자신의 user_id prefix 가 있는 private-uploads 파일만 select. service role 은 RLS bypass.';
