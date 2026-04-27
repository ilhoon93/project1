-- ============================================================
-- 001_initial.sql — Phase 1 MVP schema
-- Tables, indexes, RLS, RPC, triggers
-- ============================================================

-- ── extensions ───────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- Extra metadata for auth.users (one-to-one).
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- invitations
-- One invitation per couple (per session). Locked once published.
-- ============================================================
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  slug          text unique not null,

  -- publication state
  is_published  boolean not null default false,
  published_at  timestamptz,
  expires_at    timestamptz,

  -- core info
  groom_name    text not null,
  bride_name    text not null,
  wedding_date  date,

  -- content (validated by Zod on app side)
  content       jsonb not null default '{}'::jsonb,

  -- payment
  total_price   integer not null default 9900,
  paid_at       timestamptz,
  payment_id    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_invitations_slug    on public.invitations (slug);
create index idx_invitations_user    on public.invitations (user_id);
create index idx_invitations_expires on public.invitations (expires_at)
  where expires_at is not null;

-- ============================================================
-- guest_visits
-- Anonymous visit telemetry (one row per session).
-- ============================================================
create table public.guest_visits (
  id               uuid primary key default gen_random_uuid(),
  invitation_id    uuid not null references public.invitations(id) on delete cascade,
  visitor_name     text,
  visitor_side     text check (visitor_side in ('groom', 'bride')),
  device_type      text,
  duration_seconds integer,
  slides_viewed    jsonb default '[]'::jsonb,
  visited_at       timestamptz not null default now()
);

create index idx_visits_invitation on public.guest_visits (invitation_id);

-- ============================================================
-- signatures
-- Guest e-signatures from main slide entry popup.
-- ============================================================
create table public.signatures (
  id                    uuid primary key default gen_random_uuid(),
  invitation_id         uuid not null references public.invitations(id) on delete cascade,
  visitor_name          text not null,
  visitor_side          text check (visitor_side in ('groom', 'bride')),
  signature_data        text,
  consent_personal_info boolean not null default false,
  created_at            timestamptz not null default now()
);

create index idx_signatures_invitation on public.signatures (invitation_id);

-- ============================================================
-- quiz_responses
-- ============================================================
create table public.quiz_responses (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations(id) on delete cascade,
  visitor_name    text,
  question_index  integer not null,
  selected_option integer not null,
  is_correct      boolean,
  created_at      timestamptz not null default now()
);

create index idx_quiz_invitation on public.quiz_responses (invitation_id);

-- ============================================================
-- vote_responses
-- ============================================================
create table public.vote_responses (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid not null references public.invitations(id) on delete cascade,
  visitor_name    text,
  question_index  integer not null,
  selected_option integer not null,
  created_at      timestamptz not null default now()
);

create index idx_vote_invitation on public.vote_responses (invitation_id);

-- ============================================================
-- guestbook_messages
-- ============================================================
create table public.guestbook_messages (
  id                    uuid primary key default gen_random_uuid(),
  invitation_id         uuid not null references public.invitations(id) on delete cascade,
  visitor_name          text not null,
  message               text not null,
  consent_personal_info boolean not null default false,
  created_at            timestamptz not null default now()
);

create index idx_guestbook_invitation on public.guestbook_messages (invitation_id);

-- ============================================================
-- RLS — enable on all tables
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.invitations         enable row level security;
alter table public.guest_visits        enable row level security;
alter table public.signatures          enable row level security;
alter table public.quiz_responses      enable row level security;
alter table public.vote_responses      enable row level security;
alter table public.guestbook_messages  enable row level security;

-- ── profiles: each user manages their own row ────────────
create policy "users select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── invitations ──────────────────────────────────────────
create policy "owners select own invitations"
  on public.invitations for select
  using (auth.uid() = user_id);

create policy "anyone selects published invitations"
  on public.invitations for select
  using (is_published = true);

create policy "owners insert invitations"
  on public.invitations for insert
  with check (auth.uid() = user_id);

create policy "owners update unpublished invitations"
  on public.invitations for update
  using (auth.uid() = user_id and is_published = false);

create policy "owners delete unpublished invitations"
  on public.invitations for delete
  using (auth.uid() = user_id and is_published = false);

-- ============================================================
-- Guest data policies
--   SELECT: only the invitation owner can read
--   INSERT: anyone, but only for PUBLISHED + non-expired invitations
--           (defense-in-depth even if anon key is used)
-- ============================================================

-- helper: is the given invitation public-and-active right now?
create or replace function public.invitation_is_active(inv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invitations
    where id = inv_id
      and is_published = true
      and (expires_at is null or expires_at > now())
  );
$$;

-- guest_visits
create policy "owners read own guest_visits"
  on public.guest_visits for select
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
create policy "anyone inserts visits to active invitations"
  on public.guest_visits for insert
  with check (public.invitation_is_active(invitation_id));

-- signatures
create policy "owners read own signatures"
  on public.signatures for select
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
create policy "anyone inserts signatures to active invitations"
  on public.signatures for insert
  with check (public.invitation_is_active(invitation_id));

-- quiz_responses
create policy "owners read own quiz_responses"
  on public.quiz_responses for select
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
create policy "anyone inserts quiz_responses to active invitations"
  on public.quiz_responses for insert
  with check (public.invitation_is_active(invitation_id));

-- vote_responses
create policy "owners read own vote_responses"
  on public.vote_responses for select
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
create policy "anyone inserts vote_responses to active invitations"
  on public.vote_responses for insert
  with check (public.invitation_is_active(invitation_id));

-- guestbook_messages
create policy "owners read own guestbook_messages"
  on public.guestbook_messages for select
  using (
    invitation_id in (select id from public.invitations where user_id = auth.uid())
  );
create policy "anyone reads guestbook of active invitations"
  on public.guestbook_messages for select
  using (public.invitation_is_active(invitation_id));
create policy "anyone inserts guestbook_messages to active invitations"
  on public.guestbook_messages for insert
  with check (public.invitation_is_active(invitation_id));

-- ============================================================
-- publish_invitation(inv_id)
-- Atomic: row-lock the invitation, validate, flip is_published.
-- Sets expires_at = wedding_date + 30 days (or now + 30 days
-- if wedding_date is null).
-- ============================================================
create or replace function public.publish_invitation(inv_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select * into inv
  from public.invitations
  where id = inv_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Not found or unauthorized';
  end if;

  if inv.is_published then
    raise exception 'Already published';
  end if;

  if inv.paid_at is null then
    raise exception 'Payment required';
  end if;

  update public.invitations
  set
    is_published = true,
    published_at = now(),
    expires_at   = coalesce(inv.wedding_date::timestamptz, now()) + interval '30 days',
    updated_at   = now()
  where id = inv_id;

  return true;
end;
$$;

-- ============================================================
-- updated_at auto-touch trigger
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger invitations_touch_updated_at
  before update on public.invitations
  for each row execute function public.touch_updated_at();

-- ============================================================
-- profile auto-creation on signup
-- A row in public.profiles is created whenever a new auth.users row appears.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
