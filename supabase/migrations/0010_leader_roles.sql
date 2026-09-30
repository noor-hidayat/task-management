-- 0010: Rename leader -> Team Leader, Foreman setara leader
-- Role kanonis sekarang: admin, Team Leader, Foreman, Member.
-- Foreman & Team Leader punya hak leader di RLS.
--
-- Jalankan di Dashboard (SQL Editor) sekali.

-- ── Pastikan role kanonis ada ──────────────────────────────────
insert into public.roles (name) values
  ('admin'),
  ('Team Leader'),
  ('Foreman'),
  ('Member')
on conflict (name) do nothing;

-- ── Normalisasi data lama (lowercase) ke kanonis ───────────────
-- FK profiles_role_fkey = ON UPDATE CASCADE, tapi update explicit
-- lebih aman untuk DB yang constraint-nya dibuat sebelum cascade.
update public.profiles set role = 'Team Leader' where role = 'leader';
update public.profiles set role = 'Member' where role = 'member';

-- Hapus baris role lama kalau sudah tidak dipakai.
delete from public.roles where name in ('leader', 'member')
  and not exists (select 1 from public.profiles p where p.role = roles.name);

-- Default profil baru = Member (kapital, sesuai seed).
alter table public.profiles alter column role set default 'Member';

-- ── RLS helpers: Foreman setara Team Leader ────────────────────
-- current_profile_role sebelumnya returns user_role (enum) — pecah untuk
-- nama custom seperti 'Team Leader'. Ubah ke text.
-- Wajib DROP dulu karena Postgres melarang ganti return type via OR REPLACE.
drop function if exists public.current_profile_role();
create or replace function public.current_profile_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_leader()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('admin','Team Leader','Foreman') from public.profiles where id = auth.uid()), false);
$$;

-- Leader dari tim tertentu (atau admin).
-- Team Leader / Foreman hanya untuk timnya sendiri.
create or replace function public.is_leader_of(target_team uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid())
    or (select role in ('Team Leader','Foreman') from public.profiles where id = auth.uid())
       and target_team is not null
       and target_team = (select team_id from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ── Trigger: fallback ke Member (kapital) ──────────────────────
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
