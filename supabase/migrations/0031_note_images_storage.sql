-- 0031: Note images — private Supabase Storage bucket + RLS mengikuti permission Note.
--
-- Struktur path: notes/{user_id}/{note_id}/image-{id}.webp
-- (nama bucket 'notes', path di dalam bucket "{user_id}/{note_id}/...").
--
-- Permission mengikuti Note (bukan public URL):
-- - INSERT/UPDATE/DELETE hanya owner (folder pertama = auth.uid()).
-- - SELECT (baca/signed URL) bila bisa membaca Note-nya
--   (owner / shared / admin, lewat public.can_read_note).

-- ── bucket privat ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('notes', 'notes', false)
on conflict (id) do nothing;

-- ── RLS storage.objects untuk bucket notes ─────────────────────
-- foldername[1] = user_id, foldername[2] = note_id (uuid).

drop policy if exists "notes images select" on storage.objects;
create policy "notes images select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_read_note(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "notes images insert" on storage.objects;
create policy "notes images insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "notes images update" on storage.objects;
create policy "notes images update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "notes images delete" on storage.objects;
create policy "notes images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
