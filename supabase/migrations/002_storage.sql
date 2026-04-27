-- ============================================================
-- 002_storage.sql — Storage buckets + RLS
--
-- Buckets:
--   public-images   : public read, owner can write under invitations/{invitationId}/
--   private-uploads : owner-only read/write under {userId}/
--
-- This migration must be run with service_role or db-owner privileges
-- (Supabase Studio SQL Editor or `supabase db push` both work).
-- ============================================================

-- ── buckets ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('public-images',   'public-images',   true),
  ('private-uploads', 'private-uploads', false)
on conflict (id) do nothing;

-- ============================================================
-- public-images
--   path convention: invitations/{invitationId}/<file>
-- ============================================================

-- public read
create policy "public read public-images"
  on storage.objects for select
  using (bucket_id = 'public-images');

-- write: must be authenticated and own the invitation referenced in the path
create policy "owners write to their invitation folder"
  on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'invitations'
    and (
      (storage.foldername(name))[2]::uuid in (
        select id from public.invitations where user_id = auth.uid()
      )
    )
  );

create policy "owners update their invitation folder"
  on storage.objects for update
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'invitations'
    and (storage.foldername(name))[2]::uuid in (
      select id from public.invitations where user_id = auth.uid()
    )
  );

create policy "owners delete their invitation folder"
  on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'invitations'
    and (storage.foldername(name))[2]::uuid in (
      select id from public.invitations where user_id = auth.uid()
    )
  );

-- ============================================================
-- private-uploads
--   path convention: {userId}/<file>
-- ============================================================

create policy "owners read their private uploads"
  on storage.objects for select
  using (
    bucket_id = 'private-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owners write their private uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'private-uploads'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owners delete their private uploads"
  on storage.objects for delete
  using (
    bucket_id = 'private-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
