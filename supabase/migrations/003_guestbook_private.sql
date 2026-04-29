-- ============================================================
-- 003_guestbook_private.sql — make guestbook messages private
--
-- Per product spec change: guestbook entries are written *to* the
-- couple and must not be visible to other guests. The owner-side
-- read policy from 001 is kept (so the couple's admin view still
-- works); the public-read policy is dropped.
-- ============================================================

drop policy if exists "anyone reads guestbook of active invitations"
  on public.guestbook_messages;
