-- 0027: Issue Types - master data untuk kategori issue
create table if not exists public.issue_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- Tambah kolom issue_type_id ke tabel issues
alter table public.issues
  add column if not exists issue_type_id uuid references public.issue_types (id) on delete set null;

create index if not exists issues_issue_type_id_idx on public.issues (issue_type_id);

-- Seed data default
insert into public.issue_types (name) values
  ('Kebocoran'),
  ('Kebisingan'),
  ('Getaran'),
  ('Overheat'),
  ('Kecepatan'),
  ('Tekanan'),
  ('Listrik'),
  ('Instrumentasi'),
  ('Safety'),
  ('Lainnya')
on conflict (name) do nothing;