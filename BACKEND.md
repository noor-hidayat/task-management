# Backend Setup — Supabase + Google Drive

Aplikasi ini memakai **Supabase** sebagai database + auth, dan **Google Drive**
sebagai storage file (evidence). Data diakses langsung dari SPA React via
`supabase-js` dengan **Row Level Security (RLS)**. Operasi file diproksikan
lewat **Supabase Edge Functions** agar kredensial Google tidak bocor ke browser.

```
React SPA ──(supabase-js)──► Supabase
   │                          ├─ Auth (email + password, username → email sintetis)
   │                          ├─ Postgres (data + RLS + realtime)
   │                          └─ Edge Functions ──► Google Drive API
   └──────────────────────────────┘   (drive, admin-users)
```

## 1. Prasyarat

- Node 18+ dan `pnpm`
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` atau via `npx`)
- Project Supabase (URL + anon key + service role key)
- Google Cloud: Service Account + **Google Drive API** aktif
- Folder di Google Drive (disarankan Shared Drive) yang di-share ke email
  Service Account sebagai **Editor**

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
# Kredensial Google Drive
supabase secrets set --env-file supabase/functions/.env

# (opsional) untuk admin-users, service role diset terpisah
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Isi `supabase/functions/.env`:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=...
```

## 5. Deploy Edge Functions

```bash
supabase functions deploy drive
supabase functions deploy admin-users
```

- `drive?action=upload|download|delete` — operasi file ke Google Drive
  (subfolder per issue/task, mis. `issue-ISS-000101/`).
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
- **Service Account Google** hanya ada di secret Edge Function; tidak pernah
  masuk bundle frontend.
- File Drive diakses lewat proxy Edge Function dengan verifikasi JWT + RLS,
  sehingga file tetap privat.
- Scope OAuth `drive.file` → app hanya bisa mengakses file yang ia buat sendiri.
