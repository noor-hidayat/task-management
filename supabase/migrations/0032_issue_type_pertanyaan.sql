-- 0032: Tambah issue type "Pertanyaan"
insert into public.issue_types (name) values ('Pertanyaan')
on conflict (name) do nothing;
