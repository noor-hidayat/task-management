import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Bantu developer mendeteksi konfigurasi yang belum lengkap.
  // (Tidak throw agar dev UI tetap tampil; query akan gagal dengan jelas.)
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset. " +
      "Salin .env.example menjadi .env.local lalu isi nilainya."
  );
}

/** Klien Supabase tunggal untuk seluruh aplikasi. */
export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** True bila env Supabase sudah terkonfigurasi. */
export const isSupabaseConfigured = Boolean(url && anonKey);
