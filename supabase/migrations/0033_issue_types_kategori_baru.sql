-- 0033: Ubah kategori issue type menjadi Human, Sistem, Lapangan
-- Pemetaan:
--   Human Error + Pertanyaan -> Human
--   System                   -> Sistem
--   Network + Hardware       -> Lapangan

begin;

insert into public.issue_types (name) values ('Human'), ('Sistem'), ('Lapangan')
on conflict (name) do nothing;

update public.issues
   set issue_type_id = (select id from public.issue_types where name = 'Human')
 where issue_type_id in (select id from public.issue_types where name in ('Human Error','Pertanyaan'));

update public.issues
   set issue_type_id = (select id from public.issue_types where name = 'Sistem')
 where issue_type_id in (select id from public.issue_types where name = 'System');

update public.issues
   set issue_type_id = (select id from public.issue_types where name = 'Lapangan')
 where issue_type_id in (select id from public.issue_types where name in ('Network','Hardware'));

delete from public.issue_types
 where name in ('Human Error','Pertanyaan','System','Network','Hardware');

commit;
