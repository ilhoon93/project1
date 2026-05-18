# PR 116 — private-uploads 버킷 RLS 정책 적용 가이드

마이그레이션 `020_snap_private_storage.sql` 은 버킷만 생성합니다. `storage.objects`
테이블은 Supabase 의 `supabase_storage_admin` 이 소유라, dashboard SQL 에디터의
`postgres` 역할로는 `CREATE POLICY` 가 실패합니다 (`ERROR: must be owner of
relation objects`).

아래 두 방법 중 하나로 4개 정책을 적용하세요.

## 방법 A — Supabase Studio Storage Policies UI (권장)

1. Studio → **Storage** → **Policies** 탭
2. `storage.objects` 행 옆 **New policy** 클릭 → "Get started quickly" 선택
3. 아래 4개 정책을 차례로 생성:

### 정책 1: `private-uploads select own`
- **Allowed operation**: SELECT
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'private-uploads' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'wedding-snap'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
  ```

### 정책 2: `private-uploads insert own`
- **Allowed operation**: INSERT
- **Target roles**: `authenticated`
- **WITH CHECK expression**: 정책 1 의 USING 과 동일

### 정책 3: `private-uploads update own`
- **Allowed operation**: UPDATE
- **Target roles**: `authenticated`
- **USING expression**: 정책 1 과 동일

### 정책 4: `private-uploads delete own`
- **Allowed operation**: DELETE
- **Target roles**: `authenticated`
- **USING expression**: 정책 1 과 동일

## 방법 B — Dashboard SQL Editor 에서 직접

대부분의 신규 Supabase 프로젝트는 `postgres` 역할이 `storage.objects` 에 정책
DDL 권한을 가지고 있어 아래 SQL 이 그대로 작동합니다. (작동 안 하면 방법 A 로
fallback)

```sql
-- 기존 정책 정리.
drop policy if exists "private-uploads select own" on storage.objects;
drop policy if exists "private-uploads insert own" on storage.objects;
drop policy if exists "private-uploads update own" on storage.objects;
drop policy if exists "private-uploads delete own" on storage.objects;

create policy "private-uploads select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

create policy "private-uploads insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

create policy "private-uploads update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

create policy "private-uploads delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-uploads' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'wedding-snap'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
```

## 검증

정책 적용 후:

1. Studio → Storage → `private-uploads` 버킷에 사용자 계정으로 로그인한 상태에서
   `{본인_user_id}/test.txt` 업로드 시도 — 성공해야 함
2. 다른 사용자 계정으로 같은 파일 select 시도 — RLS 차단되어야 함
3. service role (Edge function / API route 에서 admin client) 로 모든 경로 접근 —
   항상 성공해야 함

문제 발생 시 방법 A 의 UI 에서 정책 한 줄씩 확인 / 재생성.
