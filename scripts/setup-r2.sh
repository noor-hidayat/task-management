#!/usr/bin/env bash
# Set secret R2 + deploy ulang Edge Function `drive`.
#
# Pakai:
#   1. Isi kredensial R2 di supabase/functions/.env
#      (lihat supabase/functions/.env.example)
#   2. Pastikan sudah login Supabase CLI, atau isi
#      SUPABASE_ACCESS_TOKEN=<token> di file .env
#   3. bash scripts/setup-r2.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FN="supabase/functions/.env"
ENV_ROOT=".env"

if [ ! -f "$ENV_FN" ]; then
  echo "✗ $ENV_FN tidak ada. Salin dari $ENV_FN.example lalu isi kredensial R2."
  exit 1
fi

# ── 1. Cek kredensial R2 terisi ──────────────────────────────────
missing=0
for key in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  value=$(grep -E "^${key}=" "$ENV_FN" | head -1 | cut -d= -f2- || true)
  if [ -z "${value// /}" ]; then
    echo "✗ ${key} masih kosong di ${ENV_FN}"
    missing=1
  else
    echo "✓ ${key} terisi"
  fi
done
if [ "$missing" = "1" ]; then
  echo
  echo "Isi dulu kredensial R2. Panduan: supabase/functions/.env.example"
  exit 1
fi

# ── 2. Tentukan project ref dari .env ────────────────────────────
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

# ── 3. Access token (opsional; kalau kosong pakai sesi login CLI) ─
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

# ── 4. Set secret + deploy ───────────────────────────────────────
echo
echo "→ Set secret Edge Functions…"
npx --yes supabase secrets set --env-file "$ENV_FN" --project-ref "$PROJECT_REF"

echo
echo "→ Deploy ulang function 'drive'…"
npx --yes supabase functions deploy drive --project-ref "$PROJECT_REF"

echo
echo "✓ Selesai. Secret R2 aktif + function 'drive' memakai adapter R2."
echo "  Tes: buka aplikasi → buka issue/task → upload evidence."
