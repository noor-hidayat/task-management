#!/usr/bin/env bash
# Deploy Edge Function `drive` (Supabase Storage) pakai token dari file.
#
# Pakai:
#   1. Taruh token Management API Supabase (sbp_...) di supabase/.sbp_token
#   2. Jalankan: bash scripts/deploy-drive.sh
#
# Token TIDAK pernah ditampilkan ke layar/chat.
set -euo pipefail

cd "$(dirname "$0")/.."

TOKEN_FILE="supabase/.sbp_token"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Token belum ada di $TOKEN_FILE" >&2
  exit 1
fi

SUPABASE_ACCESS_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  echo "File $TOKEN_FILE kosong." >&2
  exit 1
fi
export SUPABASE_ACCESS_TOKEN

REF="$(cat supabase/.temp/project-ref 2>/dev/null || echo xjlwgkqovvfckxbsijlu)"
echo "→ Deploy Edge Function 'drive' ke project $REF ..."
npx --yes supabase functions deploy drive --project-ref "$REF"
echo "✓ Selesai."
