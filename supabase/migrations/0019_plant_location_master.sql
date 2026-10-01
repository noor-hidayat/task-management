-- 0019: Master tables for Plant & Location (independent lists).
-- Managed directly in the database (no app UI). App only reads (SELECT).
create table if not exists public.plants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plants    enable row level security;
alter table public.locations enable row level security;

drop policy if exists plants_select on public.plants;
create policy plants_select on public.plants
  for select to authenticated using (true);

drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
  for select to authenticated using (true);

grant select on public.plants, public.locations to authenticated;
