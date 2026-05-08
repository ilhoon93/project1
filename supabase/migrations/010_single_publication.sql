-- ============================================================
-- 010_single_publication.sql
--
-- 정책 변경: 한 알림장당 활성 publication 은 1개로 고정.
-- "재발행" 개념 제거 — 한 번 발행되면 그 URL 을 평생 유지하고, 이후 편집은
-- publications.content 를 in-place 갱신하는 방식으로 전환.
--
-- 작업:
--   1) publish_invitation_v4 — 이미 활성 publication 이 있으면 그대로 반환
--      (발행권 차감 안 함). 재발행 시도해도 같은 URL.
--   2) publications UPDATE 정책 — 소유자가 content 를 in-place 갱신할 수 있게
--      (security definer 없이 RLS 로 허용).
--   3) quiz_responses / vote_responses DELETE 정책 — 소유자가 자기 알림장 응답을
--      삭제할 수 있게 (퀴즈/투표 수정 시 응답 정합성 유지용).
-- ============================================================

-- (1) publish_invitation_v4 — 이미 발행됐으면 기존 정보 반환.
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
  existing     record;
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

  -- 이미 활성 publication 이 있으면 그대로 반환 — 발행권 차감하지 않음.
  -- archived = true 인 publication 은 만료가 없는 것으로 간주.
  select id, slug, owner_token, expires_at
    into existing
    from public.publications
   where invitation_id = inv_id
     and revoked_at is null
     and (archived = true or expires_at > now())
   order by created_at asc
   limit 1;

  if found then
    return jsonb_build_object(
      'publication_id', existing.id,
      'slug',           existing.slug,
      'owner_token',    existing.owner_token,
      'expires_at',     existing.expires_at,
      'reused',         true
    );
  end if;

  select coalesce(sum(delta), 0)::integer
    into balance
    from public.publish_credits_ledger
   where user_id = caller;

  if balance < 1 then
    raise exception 'Insufficient publish credits (balance=%)' , balance using errcode = 'P0001';
  end if;

  -- 만료 기준: max(결혼식 날짜 + 30일, 발행 + 30일).
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
    'expires_at',     expires,
    'reused',         false
  );
end;
$$;

-- (2) publications UPDATE — 소유자가 content/이름/날짜 in-place 갱신 가능.
--     단, slug / owner_token / user_id / invitation_id 등 식별자는 RLS 가
--     보호하지 못하므로 PATCH API 가 select-list 에서 제한해야 함 (DB 차원에서는
--     소유자라는 사실만 검증).
drop policy if exists "owners update own publications" on public.publications;
create policy "owners update own publications"
  on public.publications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (3) quiz_responses / vote_responses DELETE — 소유자만.
drop policy if exists "owners delete own quiz_responses" on public.quiz_responses;
create policy "owners delete own quiz_responses"
  on public.quiz_responses for delete
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );

drop policy if exists "owners delete own vote_responses" on public.vote_responses;
create policy "owners delete own vote_responses"
  on public.vote_responses for delete
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
