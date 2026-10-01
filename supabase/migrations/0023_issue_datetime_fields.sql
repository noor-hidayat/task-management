-- 0023: Add start_datetime and end_datetime to issues.
alter table public.issues add column if not exists start_datetime timestamptz;
alter table public.issues add column if not exists end_datetime timestamptz;