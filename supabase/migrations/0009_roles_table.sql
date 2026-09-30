-- 0009: Tabel roles (master data role, simpel)
-- Menggantikan enum user_role yang hardcoded agar role bisa dikelola via database.
-- Desain simpel: roles.name sebagai PK (text) sehingga profiles.role tetap string
-- dan seluruh kode frontend/RLS yang membandingkan role = 'admin' tetap jalan.
--
-- Cara pakai di Dashboard (SQL Editor), jalankan file ini sekali:
--   1) buat tabel + seed admin/leader/member
--   2) konversi profiles.role dari enum ke text + FK ke roles(name)
--   3) RLS + trigger validasi role

-- ── Tabel roles (hanya name) ───────────────────────────────────
create table if not exists public.roles (
  name        text primary key,
  created_at  timestamptz not null default now()
);

-- Bersihkan kolom tak terpakai kalau migrasi lama sempat jalan.
alter table public.roles drop column if exists description;
alter table public.roles drop column if exists level;

insert into public.roles (name) values
  ('admin'),
  ('Team Leader'),
  ('Foreman'),
  ('Member')
on conflict (name) do nothing;

-- ── Konversi profiles.role: enum -> text + FK ──────────────────
-- Kolom profiles.role saat ini bertipe user_role enum.
-- Ubah ke text agar bisa FK ke roles(name) dan bisa tambah role custom.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and udt_name = 'user_role'
  ) then
    alter table public.profiles alter column role type text using role::text;
  end if;
end $$;

-- Default tetap Member.
alter table public.profiles alter column role set default 'Member';

-- FK profiles.role -> roles.name (agar role wajib terdaftar di tabel roles).
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'profiles'
      and constraint_name = 'profiles_role_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_role_fkey
      foreign key (role) references public.roles (name)
      on update cascade on delete restrict;
  end if;
end $$;

-- ── RLS untuk roles ────────────────────────────────────────────
alter table public.roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated using (true);

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.roles to anon;
grant select, insert, update, delete on public.roles to authenticated;

-- ── Trigger: validasi role saat user baru dibuat ───────────────
-- Kalau metadata role tidak dikenal / kosong, fallback ke 'Member'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'Member');
begin
  if not exists (select 1 from public.roles where name = v_role) then
    v_role := 'Member';
  end if;
  insert into public.profiles (id, name, username, initials, role, team_id, shift)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'initials',
    v_role,
    nullif(new.raw_user_meta_data ->> 'team_id', '')::uuid,
    new.raw_user_meta_data ->> 'shift'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Enum user_role lama sengaja TIDAK di-drop agar rollback aman.
-- Fungsi RLS (is_admin/is_leader/dll) tetap jalan karena masih
-- membandingkan text: role = 'admin'.
