-- 0034: Note sharing — Public visibility, Edit permission, and Note comments.
--
-- (1) notes.visibility: 'private' (default) | 'public'. Public = any signed-in
--     user can read the note (read-only). Owner-only edit unless a share grants
--     'edit'.
-- (2) can_read_note(): owner / admin / shared / public.
--     can_edit_note(): owner / admin / share.permission = 'edit'.
-- (3) comments/activities for notes: enum owner_kind gains 'note'; note comments
--     are only visible/insertable when the note itself is readable.
-- (4) cleanup_note_rows(): delete comments/activities/notifications on note delete.

-- ── (1) visibility ───────────────────────────────────────────────
alter table public.notes add column if not exists visibility text not null default 'private';
alter table public.notes drop constraint if exists notes_visibility_check;
alter table public.notes add constraint notes_visibility_check
  check (visibility in ('private', 'public'));
create index if not exists notes_visibility_idx on public.notes (visibility);

-- ── (2) read / edit helpers ──────────────────────────────────────
create or replace function public.can_read_note(n_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.notes n
    where n.id = n_id
      and (n.owner_id = auth.uid() or n.visibility = 'public' or public.is_admin())
  )
  or exists (
    select 1 from public.note_shares s
    where s.note_id = n_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_note(n_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.notes n
    where n.id = n_id and (n.owner_id = auth.uid() or public.is_admin())
  )
  or exists (
    select 1 from public.note_shares s
    where s.note_id = n_id and s.user_id = auth.uid() and s.permission = 'edit'
  );
$$;

-- ── (3) notes policies ───────────────────────────────────────────
-- Baca bila owner / admin / public / shared. Tulis hanya owner (admin bebas).
-- CATATAN: klausa `owner_id = auth.uid()` tetap eksplisit karena PostgREST
-- memakai INSERT ... RETURNING (baris baru belum terlihat oleh can_read_note()).
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated using (owner_id = auth.uid() or public.can_read_note(id));

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (owner_id = auth.uid() or public.can_edit_note(id))
  with check (owner_id = auth.uid() or public.can_edit_note(id));

-- ── (4) comments / activities untuk note ─────────────────────────
-- Komentar note hanya terlihat/ditulis bila note-nya bisa dibaca (menghormati
-- private + share). Komentar task/issue tetap seperti sebelumnya.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (owner_type <> 'note' or public.can_read_note(owner_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (author_id = auth.uid() and (owner_type <> 'note' or public.can_read_note(owner_id)));

drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated
  using (owner_type <> 'note' or public.can_read_note(owner_id));

-- ── (5) note_shares: izinkan owner ubah permission (view ↔ edit) ──
-- Policy UPDATE wajib ada; tanpa ini setSharePermission() diam-diam no-op
-- (RLS memblokir tanpa error yang jelas).
drop policy if exists note_shares_update on public.note_shares;
create policy note_shares_update on public.note_shares
  for update to authenticated
  using (public.is_note_owner(note_id) or public.is_admin())
  with check (public.is_note_owner(note_id) or public.is_admin());

-- ── (6) cleanup saat note dihapus ────────────────────────────────
create or replace function public.cleanup_note_rows()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.comments   where owner_type = 'note' and owner_id = OLD.id;
  delete from public.activities where owner_type = 'note' and owner_id = OLD.id;
  delete from public.notifications where link = '/notes?note=' || OLD.id;
  return OLD;
end $$;

drop trigger if exists notes_cleanup on public.notes;
create trigger notes_cleanup
  before delete on public.notes
  for each row execute function public.cleanup_note_rows();

-- ── (6) grants ───────────────────────────────────────────────────
grant execute on function public.can_edit_note(uuid) to authenticated;

-- CATATAN DEPLOY: enum owner_kind harus ditambah di transaksi TERPISAH
-- (PostgreSQL melarang pemakaian nilai enum baru pada transaksi yang sama):
--   alter type public.owner_kind add value if not exists 'note';
