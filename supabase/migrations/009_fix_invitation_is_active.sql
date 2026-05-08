-- ============================================================
-- 009_fix_invitation_is_active.sql
--
-- 문제: 게스트가 방명록 메시지를 등록하면 RLS 정책이
--   "new row violates row-level security policy for table guestbook_messages"
-- 로 거절하는 케이스 발생.
--
-- 원인:
--   `invitation_is_active(inv_id)` 함수가 invitations.expires_at 만 보는데,
--   publish_invitation_v4 가 expires 를 (wedding_date + 30일) 로 계산하므로
--   wedding_date 가 과거인 알림장은 발행 직후부터 expires_at < now() 가 되어
--   RLS 가 모든 guest 입력을 차단함.
--
--   또한 다중 발행(재발행) 시 invitations.expires_at 이 최신 publish 의
--   expires 로 OVERWRITE 되므로, 새 publish 가 짧은 expiry 를 가지면
--   기존 URL 의 RLS 까지 깨지는 부작용도 있음.
--
-- 수정:
--   1) invitation_is_active 를 publications 기준으로 변경. 활성 publication
--      (revoked_at is null AND (archived OR expires_at > now())) 이 하나라도
--      있으면 active 로 간주. 레거시 invitations.is_published 도 OR 로 유지해
--      마이그레이션 이전 데이터 호환.
--
--   2) publish_invitation_v4 의 expires 에 now() + 30일 하한 추가.
--      wedding_date 가 과거여도 최소 발행일+30일은 보장.
--
--   3) invitations.expires_at 갱신을 greatest(...) 로 변경해 다중 발행 시
--      expires 가 줄어드는 일이 없게 함.
-- ============================================================

-- (1) RLS 헬퍼 — publications 기준으로 변경.
create or replace function public.invitation_is_active(inv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- 새 모델 — 활성 publication 이 있으면 true.
    exists (
      select 1 from public.publications
      where invitation_id = inv_id
        and revoked_at is null
        and (archived = true or expires_at > now())
    )
    or
    -- 레거시 — pre-publications 알림장 호환.
    exists (
      select 1 from public.invitations
      where id = inv_id
        and is_published = true
        and (expires_at is null or expires_at > now())
    );
$$;

comment on function public.invitation_is_active(uuid) is
  '게스트(서명/방명록/퀴즈/투표) 입력을 허용할지 판정. 활성 publication 또는 레거시 is_published 이면 true.';

-- (2) publish_invitation_v4 — expires 하한 보장.
create or replace function public.publish_invitation_v4(
  inv_id        uuid,
  new_slug      text,
  new_owner_tok text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv          record;
  caller       uuid := auth.uid();
  balance      integer;
  ledger_id    uuid;
  pub_id       uuid;
  expires      timestamptz;
begin
  if caller is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select *
    into inv
    from public.invitations
   where id = inv_id and user_id = caller
   for update;

  if not found then
    raise exception 'Not found or unauthorized' using errcode = 'P0002';
  end if;

  select coalesce(sum(delta), 0)::integer
    into balance
    from public.publish_credits_ledger
   where user_id = caller;

  if balance < 1 then
    raise exception 'Insufficient publish credits (balance=%)' , balance using errcode = 'P0001';
  end if;

  -- 만료 기준: max(결혼식 날짜 + 30일, 발행 + 30일).
  -- wedding_date 가 과거여도 최소 발행+30일 은 보장 (게스트 메시지 시간 확보).
  if inv.wedding_date is not null then
    expires := greatest(
      (inv.wedding_date::timestamptz + interval '30 days'),
      now() + interval '30 days'
    );
  else
    expires := now() + interval '30 days';
  end if;

  insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'publish', 'invitations', inv_id, 'publish_invitation_v4')
  returning id into ledger_id;

  insert into public.publications (
    invitation_id, user_id, slug,
    groom_name, bride_name, wedding_date,
    content, expires_at, credit_ledger_id, owner_token
  ) values (
    inv_id, caller, new_slug,
    inv.groom_name, inv.bride_name, inv.wedding_date,
    inv.content, expires, ledger_id, new_owner_tok
  )
  returning id into pub_id;

  -- invitations.expires_at 은 모든 publish 중 가장 늦은 만료로 유지 (절대 줄지 않음).
  update public.invitations
     set is_published = true,
         published_at = coalesce(published_at, now()),
         expires_at   = greatest(coalesce(expires_at, '-infinity'::timestamptz), expires),
         updated_at   = now()
   where id = inv_id;

  return jsonb_build_object(
    'publication_id', pub_id,
    'slug',           new_slug,
    'owner_token',    new_owner_tok,
    'expires_at',     expires
  );
end;
$$;

-- (3) 기존 데이터 보정 — 이미 발행됐는데 invitations.expires_at 이 과거인 행을
--     publications 의 가장 늦은 expires_at 으로 끌어올린다.
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
