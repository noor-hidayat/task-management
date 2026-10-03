# Backend Setup — Supabase + Cloudflare R2

Aplikasi ini memakai **Supabase** sebagai database + auth, dan
**Cloudflare R2** (object storage, S3-compatible) sebagai storage file
(evidence). Data diakses langsung dari SPA React via `supabase-js` dengan
**Row Level Security (RLS)**. Operasi file diproksikan lewat **Supabase Edge
Functions** agar kredensial storage tidak bocor ke browser.

```
React SPA ──(supabase-js)──► Supabase
   │                          ├─ Auth (email + password, username → email sintetis)
   │                          ├─ Postgres (data + RLS + realtime)
   │                          └─ Edge Functions ──► Cloudflare R2 (S3 API)
   └──────────────────────────────┘   (drive, admin-users)
```

## 1. Prasyarat

- Node 18+ dan `pnpm`
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` atau via `npx`)
- Project Supabase (URL + anon key + service role key)
- Akun Cloudflare dengan **R2** aktif + sebuah bucket (mis. `tims-evidence`)

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

## 4. Set secret Edge Functions

```bash
# Kredensial Cloudflare R2
supabase secrets set --env-file supabase/functions/.env

# (opsional) untuk admin-users, service role diset terpisah
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Isi `supabase/functions/.env`:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tims-evidence
# opsional: R2_ENDPOINT, R2_REGION, R2_PREFIX
```

## 5. Deploy Edge Functions

```bash
supabase functions deploy drive
supabase functions deploy admin-users
```

- `drive?action=upload|download|delete` — operasi file ke R2
  (sub-prefix per issue/task, mis. `tims/issue-ISS-000101/`).
  Nama fungsi tetap `drive` demi kompatibilitas frontend; kolom DB
  `drive_file_id` kini berisi **object key** R2 dan `drive_folder_id` berisi
  **prefix**.
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
- **Kredensial R2** hanya ada di secret Edge Function; tidak pernah
  masuk bundle frontend.
- File diakses lewat proxy Edge Function dengan verifikasi JWT + RLS,
  sehingga file tetap privat (bucket tidak perlu publik).
