-- 0022: Cascade cleanup when a work/issue is deleted.
-- Removes comments, activities, leftover attachments, and notifications
-- pointing at the deleted entity. Cancelled items are NOT deleted (flag only),
-- so nothing is cleaned for them.
create or replace function public.cleanup_owner_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_kind public.owner_kind;
  link_path  text;
begin
  if TG_TABLE_NAME = 'works' then
    owner_kind := 'work';
    link_path  := '/tasks/' || OLD.number;
  else
    owner_kind := 'issue';
    link_path  := '/issues/' || OLD.number;
  end if;

  delete from public.comments     where owner_type = owner_kind and owner_id = OLD.id;
  delete from public.activities   where owner_type = owner_kind and owner_id = OLD.id;
  delete from public.attachments  where owner_type = owner_kind and owner_id = OLD.id;
  delete from public.notifications where link = link_path;

  return OLD;
end $$;

drop trigger if exists works_cleanup on public.works;
create trigger works_cleanup
  before delete on public.works
  for each row execute function public.cleanup_owner_rows();

drop trigger if exists issues_cleanup on public.issues;
create trigger issues_cleanup
  before delete on public.issues
  for each row execute function public.cleanup_owner_rows();
