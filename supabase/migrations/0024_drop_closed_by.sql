-- 0024: Drop closed_by column from issues (activity feed already tracks who closed it).
alter table public.issues drop column if exists closed_by;
