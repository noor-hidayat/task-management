# Backend Setup — Supabase (database + auth + storage)

Aplikasi ini memakai **Supabase** sebagai database + auth, dan
**Supabase Storage** sebagai storage file (evidence task/issue + gambar note).
Data diakses langsung dari SPA React via `supabase-js` dengan
**Row Level Security (RLS)**. Operasi file diproksikan lewat **Supabase Edge
Functions** agar hak akses tervalidasi di server.

```
React SPA ──(supabase-js)──► Supabase
   │                          ├─ Auth (email + password, username → email sintetis)
   │                          ├─ Postgres (data + RLS + realtime)
   │                          ├─ Storage (bucket `attachments` + `notes`)
   │                          └─ Edge Functions ──► Supabase Storage
   └──────────────────────────────┘   (drive, admin-users)
```

## 1. Prasyarat

- Node 18+ dan `pnpm`
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` atau via `npx`)
- Project Supabase (URL + anon key + service role key)

## 2. Konfigurasi frontend

```bash
cp .env.example .env.local
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
```

## 3. Terapkan skema database

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push          # menjalankan semua file di supabase/migrations
```

Migrasi:
| File | Isi |
|---|---|
| `0001_extensions_and_enums.sql` | Ekstensi + enum types |
| `0002_core_tables.sql` | teams, shifts, profiles, schedules |
| `0003_work_tables.sql` | works, work_checklist, issues, attachments, comments, activities, notifications |
| `0004_rls_helpers.sql` | Fungsi helper RLS (`is_admin`, `can_read_work`, dll.) |
| `0005_rls_policies.sql` | Semua policy RLS |
| `0006_triggers.sql` | Auto profile, penomoran, handover, updated_at |
| `0007_grants.sql` | Grant ke role `authenticated`/`anon` |
| `0008_seed_base.sql` | Seed shift, tim, core work |

## 4. Storage (Supabase Storage)

Semua file disimpan di **Supabase Storage**, TIDAK ada kredensial pihak ketiga:

- bucket **`attachments`** → file evidence task/issue
- bucket **`notes`** → gambar di dalam note

Kedua bucket privat dan dibuat otomatis lewat migrasi database (`0031`, `0035`).
Akses file lewat Edge Function `drive` yang memakai SERVICE ROLE (bypass RLS)
dan memverifikasi hak akses user sendiri. `SUPABASE_URL` dan
`SUPABASE_SERVICE_ROLE_KEY` di-inject otomatis oleh Supabase ke setiap Edge
Function, jadi tak ada yang perlu diisi di `supabase/functions/.env`.

Opsional: `STORAGE_MAX_BYTES` (batas upload, default 1 GiB = kuota storage
gratis Supabase).

## 5. Deploy Edge Functions

```bash
npx supabase functions deploy drive
npx supabase functions deploy admin-users
```

Atau lewat helper: `bash scripts/setup-storage.sh` (baca project ref dari
`.env`, butuh login CLI atau `SUPABASE_ACCESS_TOKEN`).

- `drive?action=upload|download|delete|usage` — operasi file ke Supabase Storage
  (sub-prefix per issue/task, mis. `issue-ISS-000101/`).
  Nama fungsi tetap `drive` demi kompatibilitas frontend; kolom DB
  `drive_file_id` kini berisi **object key** storage dan `drive_folder_id`
  berisi **prefix**.
  - `action=usage` mengembalikan kapasitas storage (terpakai, batas, sisa).
  - **Batas kuota**: sebelum upload, fungsi menghitung pemakaian storage
    sebenarnya (jumlah byte semua objek di bucket `attachments` + `notes`).
    Bila `terpakai + file baru > STORAGE_MAX_BYTES` (default **1 GiB**), upload
    ditolak dengan HTTP **507** dan pesan "Storage penuh". Set `STORAGE_MAX_BYTES`
    untuk mengubah batas.
  - Gambar note: `action=upload-note|sign-note|delete-note|delete-note-folder`.
- `admin-users` — create/update/delete user oleh admin (butuh service role).

## 6. Seed user demo

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/seed-users.mjs
```

Membuat 15 user demo dengan password default `admin123`
(username contoh: `admin`, `operator_a`, `supervisor_a`).
Login di aplikasi memakai **username** (dipetakan ke `<username>@tm.local`).

## 7. Jalankan dev

```bash
pnpm dev
```

## Keamanan

- **RLS aktif** di semua tabel. Visibilitas data dibatasi per role/tim:
  admin akses penuh, leader mengelola timnya, member melihat data tim &
  yang ditugaskan padanya.
- **Password** tidak pernah disimpan di database aplikasi — ditangani
  Supabase Auth (bcrypt).
- **Hak akses file** divalidasi di Edge Function (JWT + cek keanggotaan
  owner); bucket privat, tidak ada akses langsung dari browser.
- File diakses lewat proxy Edge Function dengan verifikasi JWT + RLS,
  sehingga file tetap privat (bucket tidak perlu publik).
