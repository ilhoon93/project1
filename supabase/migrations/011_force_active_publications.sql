-- ============================================================
-- 011_force_active_publications.sql
--
-- 문제: 마이그레이션 009/010 적용 후에도 게스트 방명록/서명에서 RLS 오류 재발.
--
-- 원인:
--   009 의 invitation_is_active 는 publications.expires_at > now() 또는
--   레거시 invitations.expires_at > now() 를 요구한다. 그런데 009/010 이전에
--   생성된 publications 는 expires_at = wedding_date + 30일 로 계산됐고,
--   wedding_date 가 30일+ 과거인 알림장은 publications.expires_at 도 과거.
--   009 의 invitations.expires_at 보정은 publications 의 max 만 따라가므로
--   max 자체가 과거면 보정해도 여전히 과거 → RLS 가 계속 차단.
--
-- 수정:
--   1) 기존 publications.expires_at 을 greatest(wedding_date+30d, now()+30d)
--      로 상향 보정 — 활성 publication 의 만료를 미래로 끌어올림.
--   2) invitations.expires_at 을 그에 맞춰 다시 끌어올림.
--   3) 안전하게 invitation_is_active 를 다시 등록 (009 가 적용 안 된 환경 대비).
-- ============================================================

-- (1) 기존 publications 의 만료를 미래로 보정.
update public.publications
   set expires_at = greatest(
         coalesce((wedding_date::timestamptz + interval '30 days'), now() + interval '30 days'),
         now() + interval '30 days'
       )
 where revoked_at is null
   and archived = false
   and expires_at < now() + interval '1 day';

-- (2) invitations.expires_at 을 publications 최대값으로 다시 동기화.
update public.invitations i
   set expires_at = sub.max_exp,
       is_published = true,
       updated_at = now()
  from (
    select invitation_id, max(expires_at) as max_exp
      from public.publications
     where revoked_at is null
     group by invitation_id
  ) sub
 where i.id = sub.invitation_id
   and (i.expires_at is null or i.expires_at < sub.max_exp);

-- (3) invitation_is_active — 멱등 재등록. 009 가 누락된 환경 대비.
create or replace function public.invitation_is_active(inv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.publications
      where invitation_id = inv_id
        and revoked_at is null
        and (archived = true or expires_at > now())
    )
    or
    exists (
      select 1 from public.invitations
      where id = inv_id
        and is_published = true
        and (expires_at is null or expires_at > now())
    );
$$;
