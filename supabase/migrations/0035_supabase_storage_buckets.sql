-- 0035: Bucket Supabase Storage untuk attachment task/issue.
--
-- Sebelumnya file evidence disimpan di Cloudflare R2 (bucket `tims`) dan
-- diakses lewat Edge Function `drive` (kredensial S3). Sejak migrasi ini,
-- SEMUA storage memakai Supabase Storage:
--   - bucket `attachments` → file evidence task/issue
--   - bucket `notes`       → gambar di dalam note (lihat migrasi 0031)
--
-- Akses attachment sepenuhnya lewat Edge Function `drive` yang memakai SERVICE
-- ROLE (bypass RLS) dan memverifikasi hak akses user sendiri (canAccessOwner).
-- Karena itu bucket cukup privat tanpa policy storage.objects untuk
-- `attachments`: tak ada akses langsung dari browser (nol kebocoran).

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
