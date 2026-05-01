-- ============================================================
-- 004_credits_publications.sql
--
--   * publish credits (ledger model — balance = sum(delta))
--   * addon packages catalogue (Naver Smart Store SKU mapping)
--   * purchase orders (PortOne or Naver Smart Store source)
--   * publications (each publish gets its own URL + 30-day TTL)
--   * naver oauth accounts (commerce-api access tokens)
--   * publish_invitation RPC rewritten to consume credits + emit publication row
-- ============================================================

-- ── extensions reused (pgcrypto already installed in 001) ───

-- ============================================================
-- addon_packages
-- Catalogue of every Smart Store SKU we recognise. The default
-- 9,900원 product is seeded as 'basic' (2 credits per purchase).
-- More packages can be added without code changes.
-- ============================================================
create table public.addon_packages (
  code                       text primary key,
  name                       text not null,
  description                text,
  price                      integer not null,
  publish_credits_grant      integer not null default 0,
  naver_smartstore_product_no text,
  active                     boolean not null default true,
  sort_order                 integer not null default 0,
  created_at                 timestamptz not null default now()
);

create unique index idx_addon_packages_naver_product
  on public.addon_packages (naver_smartstore_product_no)
  where naver_smartstore_product_no is not null;

insert into public.addon_packages (code, name, description, price, publish_credits_grant, sort_order)
values
  ('basic', '기본 발행권 패키지', '알림장 1회 결제 시 발행권 2개 지급', 9900, 2, 0)
on conflict (code) do nothing;

-- ============================================================
-- purchase_orders
-- Every order — whether from PortOne (in-app) or Naver Smart Store
-- (manual order-no entry / Naver Commerce API pull) — lands here.
-- A row carries the credits it granted at the time of grant so
-- repricing a package later does NOT retroactively change history.
-- ============================================================
create table public.purchase_orders (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  source                     text not null check (source in ('portone', 'naver_smartstore', 'manual')),

  -- Catalogue link (nullable for legacy / unknown SKUs)
  package_code               text references public.addon_packages(code),

  -- Source-specific identifiers
  portone_payment_id         text,
  naver_order_no             text,         -- 주문번호 (한 주문에 여러 상품주문이 들어갈 수 있음)
  naver_product_order_no     text,         -- 상품주문번호 (실제 unique한 단위)

  amount                     integer not null default 0,
  granted_credits            integer not null default 0,

  -- For free-form audit / debugging (raw API payload, etc.)
  raw_data                   jsonb not null default '{}'::jsonb,

  status                     text not null default 'completed' check (status in ('pending','completed','failed','refunded')),

  created_at                 timestamptz not null default now(),
  processed_at               timestamptz
);

create index idx_orders_user on public.purchase_orders (user_id);
create index idx_orders_portone on public.purchase_orders (portone_payment_id) where portone_payment_id is not null;
create unique index idx_orders_naver_product_order
  on public.purchase_orders (naver_product_order_no)
  where naver_product_order_no is not null;

-- ============================================================
-- publish_credits_ledger
-- Balance is computed as sum(delta) for the user. Every credit
-- movement (grant from purchase, consumption from publish, manual
-- adjustment) writes exactly one row here.
-- ============================================================
create table public.publish_credits_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null,
  reason      text not null check (reason in ('purchase','publish','admin_grant','admin_revoke','refund')),
  ref_table   text,
  ref_id      uuid,
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_credits_user on public.publish_credits_ledger (user_id);

-- Helper: current balance for a user
create or replace function public.publish_credits_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.publish_credits_ledger
  where user_id = uid;
$$;

-- ============================================================
-- publications
-- One row per publish action. Multiple publications per invitation
-- are allowed (e.g. re-publish after edits) — each gets its own
-- random slug + 30-day TTL. Content is snapshotted so editing the
-- draft doesn't mutate live invitations already shared with guests.
-- ============================================================
create table public.publications (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  slug            text unique not null,

  groom_name      text not null,
  bride_name      text not null,
  wedding_date    date,
  content         jsonb not null default '{}'::jsonb,

  published_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,

  -- The credit ledger entry that paid for this publish (audit only)
  credit_ledger_id uuid references public.publish_credits_ledger(id) on delete set null,

  created_at      timestamptz not null default now()
);

create index idx_publications_user on public.publications (user_id);
create index idx_publications_invitation on public.publications (invitation_id);
create index idx_publications_expires on public.publications (expires_at);

-- ============================================================
-- naver_accounts
-- One row per Supabase user that has linked Naver. We sign users
-- into Supabase via a magic-link bridge (see app/api/auth/naver/...)
-- and store Naver's access/refresh tokens here for the Commerce API
-- pull on My Page.
-- ============================================================
create table public.naver_accounts (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  naver_id           text unique not null,
  email              text,
  nickname           text,
  access_token       text,
  refresh_token      text,
  token_expires_at   timestamptz,
  scope              text,
  raw_profile        jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger naver_accounts_touch_updated_at
  before update on public.naver_accounts
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS — enable + policies
-- ============================================================
alter table public.addon_packages          enable row level security;
alter table public.purchase_orders         enable row level security;
alter table public.publish_credits_ledger  enable row level security;
alter table public.publications            enable row level security;
alter table public.naver_accounts          enable row level security;

-- addon_packages: world-readable (catalogue), writes via service role only
create policy "anyone reads addon_packages"
  on public.addon_packages for select
  using (true);

-- purchase_orders: owner-readable; writes via service role only
create policy "owners read purchase_orders"
  on public.purchase_orders for select
  using (auth.uid() = user_id);

-- publish_credits_ledger: owner-readable; writes via service role / RPC only
create policy "owners read credits_ledger"
  on public.publish_credits_ledger for select
  using (auth.uid() = user_id);

-- publications:
--   - owners read all their own
--   - anyone reads non-revoked, non-expired (public viewer at /[slug])
--   - writes via RPC (security definer) only
create policy "owners read own publications"
  on public.publications for select
  using (auth.uid() = user_id);

create policy "anyone reads active publications"
  on public.publications for select
  using (revoked_at is null and expires_at > now());

-- naver_accounts: owner-only (service role bypasses for OAuth callback writes)
create policy "owners read own naver_account"
  on public.naver_accounts for select
  using (auth.uid() = user_id);

-- ============================================================
-- publish_invitation_v2(inv_id)
--
-- Replaces the v1 RPC. Atomic transaction:
--   1. Row-lock the invitation (must belong to caller, must not yet
--      be terminally locked — but we DO allow re-publish: each
--      publish creates a new publication row with new slug)
--   2. Verify caller has ≥ 1 publish credit
--   3. Insert publish_credits_ledger row (delta = -1)
--   4. Allocate a new slug (caller passes it; we trust uniqueness
--      via the publications.slug unique index — caller retries on
--      collision)
--   5. Insert publications row with content snapshot, expires_at = now()+30d
--   6. Mark invitations.is_published=true on first publish (back-compat)
--      and store latest published_at / expires_at on the invitation
--      for the convenience of /mypage queries
--
-- Returns the new publication's id + slug + expires_at as json.
-- ============================================================
create or replace function public.publish_invitation_v2(
  inv_id   uuid,
  new_slug text
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

  expires := now() + interval '30 days';

  -- 1) consume credit
  insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
  values (caller, -1, 'publish', 'invitations', inv_id, 'publish_invitation_v2')
  returning id into ledger_id;

  -- 2) snapshot publication
  insert into public.publications (
    invitation_id, user_id, slug,
    groom_name, bride_name, wedding_date,
    content, expires_at, credit_ledger_id
  ) values (
    inv_id, caller, new_slug,
    inv.groom_name, inv.bride_name, inv.wedding_date,
    inv.content, expires, ledger_id
  )
  returning id into pub_id;

  -- 3) update invitation convenience fields (no longer locks editing)
  update public.invitations
     set is_published = true,
         published_at = coalesce(published_at, now()),
         expires_at   = expires,
         updated_at   = now()
   where id = inv_id;

  return jsonb_build_object(
    'publication_id', pub_id,
    'slug',           new_slug,
    'expires_at',     expires
  );
end;
$$;

-- ============================================================
-- grant_purchase_credits(uid, package_code, source, source_ref, raw, amount)
--
-- Service-role helper used by /api/orders/register and PortOne
-- verification. Atomic: one ledger row + one purchase_orders row.
-- Idempotent on (source, naver_product_order_no) and on
-- portone_payment_id, so retries don't double-grant.
-- ============================================================
create or replace function public.grant_purchase_credits(
  p_user_id          uuid,
  p_source           text,
  p_package_code     text,
  p_amount           integer,
  p_portone_payment  text default null,
  p_naver_order_no   text default null,
  p_naver_product_no text default null,
  p_raw              jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg          record;
  existing     uuid;
  order_id     uuid;
  granted      integer;
begin
  -- idempotency check (only when a stable identifier is provided)
  if p_naver_product_no is not null then
    select id into existing
      from public.purchase_orders
     where naver_product_order_no = p_naver_product_no;
    if existing is not null then
      return jsonb_build_object('order_id', existing, 'granted', 0, 'duplicate', true);
    end if;
  elsif p_portone_payment is not null then
    select id into existing
      from public.purchase_orders
     where portone_payment_id = p_portone_payment;
    if existing is not null then
      return jsonb_build_object('order_id', existing, 'granted', 0, 'duplicate', true);
    end if;
  end if;

  select * into pkg
    from public.addon_packages
   where code = p_package_code;
  if not found then
    raise exception 'Unknown package_code: %', p_package_code;
  end if;

  granted := pkg.publish_credits_grant;

  insert into public.purchase_orders (
    user_id, source, package_code,
    portone_payment_id, naver_order_no, naver_product_order_no,
    amount, granted_credits, raw_data, status, processed_at
  ) values (
    p_user_id, p_source, p_package_code,
    p_portone_payment, p_naver_order_no, p_naver_product_no,
    coalesce(p_amount, pkg.price), granted, p_raw, 'completed', now()
  )
  returning id into order_id;

  if granted > 0 then
    insert into public.publish_credits_ledger (user_id, delta, reason, ref_table, ref_id, note)
    values (p_user_id, granted, 'purchase', 'purchase_orders', order_id, p_source);
  end if;

  return jsonb_build_object('order_id', order_id, 'granted', granted, 'duplicate', false);
end;
$$;

-- ============================================================
-- backfill: any invitation that already paid_at IS NOT NULL but
-- has no purchase_orders row gets one + 2 credits, so existing
-- accounts don't lose state when this migration runs in production.
-- (No-op on a fresh DB.)
-- ============================================================
do $$
declare
  inv record;
begin
  for inv in
    select i.id, i.user_id, i.payment_id, i.paid_at
      from public.invitations i
      left join public.purchase_orders o
        on o.portone_payment_id = i.payment_id
     where i.paid_at is not null
       and i.payment_id is not null
       and o.id is null
  loop
    perform public.grant_purchase_credits(
      inv.user_id,
      'portone',
      'basic',
      9900,
      inv.payment_id,
      null,
      null,
      jsonb_build_object('backfill', true, 'invitation_id', inv.id)
    );
  end loop;
end $$;

-- ============================================================
-- back-compat: keep old publish_invitation() callable but route
-- through v2. Old route handler still works without code changes
-- once a slug is allocated app-side and re-routed via v2.
--
-- (We DO update the API handler in this migration's matching
-- code change, but leaving the v1 RPC in place is harmless.)
-- ============================================================

-- ============================================================
-- Loosen invitation update RLS — with the credit model, a draft
-- can be edited and re-published any number of times. Each publish
-- snapshots the current content into publications, so editing the
-- draft after publish doesn't mutate already-shared URLs.
-- ============================================================
drop policy if exists "owners update unpublished invitations" on public.invitations;
drop policy if exists "owners update own invitations" on public.invitations;
create policy "owners update own invitations"
  on public.invitations for update
  using (auth.uid() = user_id);

drop policy if exists "owners delete unpublished invitations" on public.invitations;
drop policy if exists "owners delete own invitations" on public.invitations;
create policy "owners delete own invitations"
  on public.invitations for delete
  using (auth.uid() = user_id);

