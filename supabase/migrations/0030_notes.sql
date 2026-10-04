-- 0030: Notes module — notes, shares, relations (tasks/issues), tags
-- Tags disimpan sebagai text[] di notes.tags (kategorisasi/filter saja,
-- bukan relasi Task/Issue). Relasi ke Task/Issue lewat note_relations.

-- ── notes ────────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles (id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_owner_id_idx on public.notes (owner_id);
create index if not exists notes_updated_at_idx on public.notes (updated_at desc);
create index if not exists notes_tags_gin_idx on public.notes using gin (tags);

-- ── note_shares (read-only "view" untuk implementasi awal, "edit" untuk masa depan)
create table if not exists public.note_shares (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  permission  text not null default 'view' check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  unique (note_id, user_id)
);

create index if not exists note_shares_note_id_idx on public.note_shares (note_id);
create index if not exists note_shares_user_id_idx on public.note_shares (user_id);

-- ── note_relations (link ke Task=works / Issue=issues, tanpa FK ganda)
create table if not exists public.note_relations (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references public.notes (id) on delete cascade,
  related_type  text not null check (related_type in ('task', 'issue')),
  related_id    uuid not null,
  created_at    timestamptz not null default now(),
  unique (note_id, related_type, related_id)
);

create index if not exists note_relations_note_id_idx on public.note_relations (note_id);
create index if not exists note_relations_related_idx on public.note_relations (related_type, related_id);

-- ── updated_at otomatis untuk notes ──────────────────────────────
drop trigger if exists trg_notes_touch on public.notes;
create trigger trg_notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ── RLS helpers ──────────────────────────────────────────────────
create or replace function public.is_note_owner(n_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.notes n
    where n.id = n_id and n.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_note(n_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.notes n
    where n.id = n_id
      and (n.owner_id = auth.uid() or public.is_admin())
  )
  or exists (
    select 1 from public.note_shares s
    where s.note_id = n_id and s.user_id = auth.uid()
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.notes enable row level security;
alter table public.note_shares enable row level security;
alter table public.note_relations enable row level security;

-- notes: baca bila owner / shared / admin. Tulis hanya owner (admin boleh hapus).
-- CATATAN: `owner_id = auth.uid()` ditulis eksplisit (bukan hanya andalkan
-- can_read_note) karena Supabase/PostgREST memakai `INSERT ... RETURNING`
-- (Prefer: return=representation). Saat RETURNING, baris baru belum terlihat
-- oleh subquery ke tabel notes di dalam can_read_note(), sehingga tanpa klausa
-- langsung ini insert dari aplikasi gagal dengan error RLS 42501.
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated using (owner_id = auth.uid() or public.can_read_note(id));

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- note_shares: baca bila bisa membaca note-nya; kelola hanya owner (admin boleh kelola).
drop policy if exists note_shares_select on public.note_shares;
create policy note_shares_select on public.note_shares
  for select to authenticated using (public.can_read_note(note_id));

drop policy if exists note_shares_insert on public.note_shares;
create policy note_shares_insert on public.note_shares
  for insert to authenticated
  with check (public.is_note_owner(note_id) or public.is_admin());

drop policy if exists note_shares_delete on public.note_shares;
create policy note_shares_delete on public.note_shares
  for delete to authenticated
  using (public.is_note_owner(note_id) or public.is_admin());

-- note_relations: baca bila bisa membaca note-nya ATAU bisa membaca Task/Issue terkait
-- (agar relasi terlihat dua arah dari sisi Task/Issue); tulis hanya owner note.
drop policy if exists note_relations_select on public.note_relations;
create policy note_relations_select on public.note_relations
  for select to authenticated
  using (
    public.can_read_note(note_id)
    or (related_type = 'task' and public.can_read_work(related_id))
    or (related_type = 'issue' and public.can_read_issue(related_id))
  );

drop policy if exists note_relations_insert on public.note_relations;
create policy note_relations_insert on public.note_relations
  for insert to authenticated
  with check (public.is_note_owner(note_id) or public.is_admin());

drop policy if exists note_relations_delete on public.note_relations;
create policy note_relations_delete on public.note_relations
  for delete to authenticated
  using (public.is_note_owner(note_id) or public.is_admin());

-- ── grants (konsisten dengan 0007) ───────────────────────────────
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_shares to authenticated;
grant select, insert, update, delete on public.note_relations to authenticated;
grant execute on function public.is_note_owner(uuid) to authenticated;
grant execute on function public.can_read_note(uuid) to authenticated;
