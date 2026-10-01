-- 0018: Add plant/location to works (mirrors issues).
alter table public.works add column if not exists plant text default '';
alter table public.works add column if not exists location text default '';
