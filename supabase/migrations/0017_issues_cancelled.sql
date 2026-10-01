-- 0017: Add cancelled flag to issues (mirrors works.cancelled).
alter table public.issues add column if not exists cancelled boolean not null default false;
