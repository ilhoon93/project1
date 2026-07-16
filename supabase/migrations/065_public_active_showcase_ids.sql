-- 065_public_active_showcase_ids.sql
--
-- 홈 showcase 커버는 스냅샷(marketing_social_proof.covers)이라 원본 알림장과
-- 독립적으로 남는다. 원본이 삭제되거나 발행이 취소된 커버는 홈에서 자동으로
-- 감춰지도록, 주어진 알림장 id 중 "현재 발행 중"인 것만 돌려주는 공개 RPC.
--
--   - 삭제된 알림장 → 결과에 없음 → 홈에서 숨김.
--   - 발행 만료(30일)는 is_published 를 바꾸지 않으므로 계속 노출(동의된 디자인 유지).
--   - 발행 취소/비공개 전환 → 숨김.
--
-- id 만 다루고 개인정보는 노출하지 않으므로 anon 실행 허용.

create or replace function public.public_active_showcase_ids(ids uuid[])
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select i.id
    from public.invitations i
   where i.id = any(ids)
     and i.is_published;
$$;

grant execute on function public.public_active_showcase_ids(uuid[]) to anon, authenticated;
