-- 0008: Seed data dasar (idempotent)
-- Insert shift, tim, core work, dan jadwal contoh.
-- User (profiles) dibuat terpisah lewat script seed-user (butuh Admin API)
-- karena harus membuat entri di auth.users.

-- ── Shifts ─────────────────────────────────────────────────────
insert into public.shifts (id, name, code, start, "end") values
  ('11111111-0000-0000-0000-000000000001', 'Shift 1', 'S1', '07:00', '15:00'),
  ('11111111-0000-0000-0000-000000000002', 'Shift 2', 'S2', '15:00', '23:00'),
  ('11111111-0000-0000-0000-000000000003', 'Shift 3', 'S3', '23:00', '07:00')
on conflict (id) do nothing;

-- ── Teams (leader_id diisi oleh script seed-user; sementara null) ──
insert into public.teams (id, name, leader_id, active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Production Team A', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Maintenance', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Quality Control', null, false),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'IT & System', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Warehouse', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Finance', null, true)
on conflict (id) do nothing;

-- ── Core works ─────────────────────────────────────────────────
insert into public.core_works
  (id, name, description, team_id, frequency, schedule, evidence_required, checklist, status)
values
  ('cccccccc-0000-0000-0000-000000000001', 'Machine Daily Inspection', 'Inspeksi harian semua line produksi', 'aaaaaaaa-0000-0000-0000-000000000001', 'Daily / Shift 1', 'S1 · 07:00', true, '["Check oil","Check temperature","Check pressure","Check vibration"]'::jsonb, 'active'),
  ('cccccccc-0000-0000-0000-000000000002', 'Temperature Check', 'Cek suhu tiap 2 jam', 'aaaaaaaa-0000-0000-0000-000000000001', 'Every 2 hours', 'All shifts', false, '["Line 1-3","Line 4-5"]'::jsonb, 'active'),
  ('cccccccc-0000-0000-0000-000000000003', 'Area Cleaning', 'Cleaning area kerja', 'aaaaaaaa-0000-0000-0000-000000000001', 'Daily', 'End of shift', false, '["Area 1","Area 2"]'::jsonb, 'active'),
  ('cccccccc-0000-0000-0000-000000000004', 'End Shift Report', 'Laporan akhir shift', 'aaaaaaaa-0000-0000-0000-000000000001', 'Per shift', '30 mnt sebelum shift end', true, '["Summary","Pending work"]'::jsonb, 'active'),
  ('cccccccc-0000-0000-0000-000000000005', 'Weekly Calibration', 'Kalibrasi mingguan', 'aaaaaaaa-0000-0000-0000-000000000002', 'Weekly', 'Monday S1', true, '["Calibrate","Record"]'::jsonb, 'inactive')
on conflict (id) do nothing;
