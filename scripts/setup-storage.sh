#!/usr/bin/env bash
# Deploy ulang Edge Function `drive` (storage Supabase Storage).
#
# Sejak migrasi ke Supabase Storage, TIDAK ada kredensial storage pihak ketiga
# yang perlu diset — Edge Function memakai SUPABASE_URL & SERVICE_ROLE_KEY yang
# di-inject otomatis oleh Supabase. Script ini hanya deploy fungsinya.
#
# Pakai:
#   1. Pastikan sudah login Supabase CLI, atau isi
#      SUPABASE_ACCESS_TOKEN=<token> di file .env
#   2. bash scripts/setup-storage.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_ROOT=".env"

# ── 1. Tentukan project ref dari .env ────────────────────────────
if [ ! -f "$ENV_ROOT" ]; then
  echo "✗ $ENV_ROOT tidak ada (butuh VITE_SUPABASE_URL)."
  exit 1
fi
SUPABASE_URL=$(grep -E '^VITE_SUPABASE_URL=' "$ENV_ROOT" | head -1 | cut -d= -f2-)
PROJECT_REF=$(printf '%s' "$SUPABASE_URL" | sed -E 's#^https?://([^.]+)\..*#\1#')
if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" = "$SUPABASE_URL" ]; then
  echo "✗ Tidak bisa membaca project ref dari VITE_SUPABASE_URL."
  exit 1
fi
echo "→ Project ref: ${PROJECT_REF}"

# ── 2. Access token (opsional; kalau kosong pakai sesi login CLI) ─
if grep -qE '^SUPABASE_ACCESS_TOKEN=.+' "$ENV_ROOT"; then
  export SUPABASE_ACCESS_TOKEN=$(grep -E '^SUPABASE_ACCESS_TOKEN=' "$ENV_ROOT" | head -1 | cut -d= -f2-)
  echo "→ Memakai SUPABASE_ACCESS_TOKEN dari ${ENV_ROOT}"
elif [ ! -f "$HOME/.supabase/access-token" ]; then
  echo
  echo "! Belum login Supabase CLI. Pilih salah satu:"
  echo "    a) npx supabase login"
  echo "    b) tambahkan SUPABASE_ACCESS_TOKEN=<token> di ${ENV_ROOT}"
  echo "       (buat di: https://supabase.com/dashboard/account/tokens)"
  exit 1
fi

# ── 3. Deploy ────────────────────────────────────────────────────
echo
echo "→ Deploy ulang function 'drive'…"
npx --yes supabase functions deploy drive --project-ref "$PROJECT_REF"

echo
echo "✓ Selesai. Function 'drive' memakai Supabase Storage."
echo "  Tes: buka aplikasi → buka issue/task → upload evidence."
