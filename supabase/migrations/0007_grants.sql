-- 0007: Grants untuk role Supabase
-- RLS tetap jadi pengaman utama; grant di bawah hanya memberi izin
-- akses tabel/fungsi ke role authenticated (dan read-only untuk anon).
-- Supabase biasanya sudah meng-grant default, ini eksplisit agar konsisten.

grant usage on schema public to anon, authenticated;

-- anon: tidak ada akses data (hanya bisa auth).
grant select on public.teams to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
