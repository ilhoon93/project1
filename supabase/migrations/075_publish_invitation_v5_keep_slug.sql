-- 075_publish_invitation_v5_keep_slug.sql
--
-- 인쇄된 QR 대응: 만료된 뒤 재발행할 때 새 slug(주소)를 만들지 않고, 직전 발행본
-- (옛 주소)을 되살린다. 청첩장 등에 인쇄한 QR 이 갱신에도 계속 유효하도록.
--
-- v4 동작 유지:
--   - 활성 publication(만료 전 또는 영구소장)이 있으면 그대로 반환(발행권 차감 없음).
-- v5 변경:
--   - 활성본이 없을 때, 이전 발행본(만료/취소 포함)이 하나라도 있으면 그 row 를
--     UPDATE 해서 같은 slug·owner_token 을 유지한 채 되살린다(만료일·내용·이름·날짜
--     갱신, revoked 해제). 발행본이 아예 없을 때만 새 slug 로 최초 발행.
--   - 재발행이므로 발행권 1 은 동일하게 차감(활성 재사용만 무료).

create or replace function public.publish_invitation_v5(
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
  inv        record;
  caller     uuid := auth.uid();
  balance    integer;
  ledger_id  uuid;
  prev       record;          -- 되살릴 직전 발행본
  pub_id     uuid;
  ret_slug   text;
  ret_tok    text;
  expires    timestamptz;
  existing   record;
begin
  if caller is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into inv
    from public.invitations
   where id = inv_id and user_id = caller
   for update;
  if not found then
    raise exception 'Not found or unauthorized' using errcode = 'P0002';
  end if;

  -- 1) 활성 publication 이 있으면 그대로 반환 — 발행권 차감 안 함(v4 와 동일).
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

  -- 2) 발행권 확인 + 만료 계산.
  select coalesce(sum(delta), 0)::integer
    into balance
    from public.publish_credits_ledger
   where user_id = caller;
  if balance < 1 then
    raise exception 'Insufficient publish credits (balance=%)', balance using errcode = 'P0001';
  end if;

  if inv.wedding_date is not null then
    expires := greatest(
      (inv.wedding_date::timestamptz + interval '30 days'),
      now() + interval '30 days'
    );
  else
    expires := now() + interval '30 days';
  end if;

  insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'publish', 'invitations', inv_id, 'publish_invitation_v5')
  returning id into ledger_id;

  -- 3) 이전 발행본(만료/취소 포함) 중 가장 최근 것을 되살려 같은 slug 유지.
  select id, slug, owner_token
    into prev
    from public.publications
   where invitation_id = inv_id
   order by created_at desc
   limit 1;

  if found then
    update public.publications
       set expires_at       = expires,
           revoked_at       = null,
           content          = inv.content,
           groom_name       = inv.groom_name,
           bride_name       = inv.bride_name,
           wedding_date     = inv.wedding_date,
           credit_ledger_id = ledger_id,
           published_at     = now()
     where id = prev.id;
    pub_id   := prev.id;
    ret_slug := prev.slug;
    ret_tok  := prev.owner_token;
  else
    -- 최초 발행 — 발행본이 하나도 없을 때만 새 slug 로 생성.
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
    ret_slug := new_slug;
    ret_tok  := new_owner_tok;
  end if;

  update public.invitations
     set is_published = true,
         published_at = coalesce(published_at, now()),
         expires_at   = greatest(coalesce(expires_at, '-infinity'::timestamptz), expires),
         updated_at   = now()
   where id = inv_id;

  return jsonb_build_object(
    'publication_id', pub_id,
    'slug',           ret_slug,
    'owner_token',    ret_tok,
    'expires_at',     expires,
    'reused',         false
  );
end;
$$;

revoke execute on function public.publish_invitation_v5(uuid, text, text) from anon;
grant execute on function public.publish_invitation_v5(uuid, text, text) to authenticated;
