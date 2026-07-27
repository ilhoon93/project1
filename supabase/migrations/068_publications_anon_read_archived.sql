-- 068_publications_anon_read_archived.sql
--
-- 버그: 영구소장(archived=true)한 알림장이 결혼식+30일(=최초 expires_at)이 지나면
--       하객용/소장용 URL 이 둘 다 404 가 됐다. 돈 내고 영구소장한 고객도 링크가
--       끊긴다.
--
-- 원인: publications 의 익명 읽기 RLS 정책이 만료만 검사하고 archived 를 무시한다.
--       004 에서
--         using (revoked_at is null and expires_at > now())
--       로 만들어진 뒤, 008~011 에서 "archived = true 면 만료 무시" 규칙을 함수/뷰/
--       페이지 코드에는 반영했지만 이 RLS 정책에는 반영하지 않았다.
--
--       하객/소장용 페이지는 로그인 없는 방문자(anon)라 이 정책이 적용된다. 만료된
--       archived row 는 정책에서 걸러져 페이지 코드까지 도달하지 못하고(=행 없음),
--       [slug] 은 missing → notFound(), [slug]/o/[token] 은 notFound() → 404.
--       페이지의 archived 우회 로직(만료 무시)은 실행될 기회조차 없었다.
--
-- 수정: 익명 읽기 정책에 archived 예외를 추가해 함수(010:58)·페이지 코드와 일치시킨다.
--         using (revoked_at is null and (archived = true or expires_at > now()))
--       비-영구소장의 만료 필터는 그대로 유지(만료된 일반 발행은 여전히 비공개).
--       소유자 본인 읽기 정책("owners read own publications")은 그대로.

drop policy if exists "anyone reads active publications" on public.publications;

create policy "anyone reads active publications"
  on public.publications for select
  using (
    revoked_at is null
    and (archived = true or expires_at > now())
  );
