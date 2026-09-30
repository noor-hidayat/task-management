-- 0007: Update number format to TK-MMYY{nnnn} and ISS-MMYY{nnnn}
-- Reset per bulan atau melanjutkan sequence per bulan MMYY.

create or replace function public.set_work_number()
returns trigger language plpgsql as $$
declare
  prefix text := 'TK-' || to_char(now(), 'MMYY');
  max_num int;
begin
  if new.number is null or new.number = '' then
    -- Cari nomor urut tertinggi untuk bulan ini (TK-MMYYnnnn)
    select coalesce(max(nullif(substring(number from 8 for 4), '')::int), 0)
      into max_num
      from public.works
     where number like prefix || '%';

    new.number := prefix || lpad((max_num + 1)::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_work_number on public.works;
create trigger trg_work_number
  before insert on public.works
  for each row execute function public.set_work_number();


create or replace function public.set_issue_number()
returns trigger language plpgsql as $$
declare
  prefix text := 'ISS-' || to_char(now(), 'MMYY');
  max_num int;
begin
  if new.number is null or new.number = '' then
    -- Cari nomor urut tertinggi untuk bulan ini (ISS-MMYYnnnn)
    select coalesce(max(nullif(substring(number from 9 for 4), '')::int), 0)
      into max_num
      from public.issues
     where number like prefix || '%';

    new.number := prefix || lpad((max_num + 1)::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_issue_number on public.issues;
create trigger trg_issue_number
  before insert on public.issues
  for each row execute function public.set_issue_number();
