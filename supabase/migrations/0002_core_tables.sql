-- 0002: Tabel inti — teams, shifts, profiles, schedules
-- profiles.id = auth.users.id

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  leader_id   uuid references auth.users (id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.shifts (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  code  text not null,
  start time not null,
  "end" time not null
);

-- Profil user, 1:1 dengan auth.users. username = kredensial login (dipetakan ke email sintetis).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  username    text not null unique,
  initials    text,
  role        user_role not null default 'member',
  team_id     uuid references public.teams (id) on delete set null,
  shift       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_team_id_idx on public.profiles (team_id);
create index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- Jadwal shift per user per hari (Mon..Sun).
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  shift_code  text,
  unique (user_id, day_of_week)
);

create index if not exists schedules_user_id_idx on public.schedules (user_id);
