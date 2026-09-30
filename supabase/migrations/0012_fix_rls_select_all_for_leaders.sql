-- 0012: Fix RLS — semua user login bisa membaca SEMUA task & issue.
-- Menu Tasks & Issues harus menampilkan seluruh data; filter "My Work"
-- dilakukan di frontend (assigned_to = user login).
-- Sebelumnya team leader hanya bisa baca data tim sendiri → tidak melihat
-- task/issue buatan admin.

-- ── works (tasks) ────────────────────────────────────────────────
drop policy if exists works_select on public.works;
create policy works_select on public.works
  for select to authenticated using (true);

-- ── issues ───────────────────────────────────────────────────────
drop policy if exists issues_select on public.issues;
create policy issues_select on public.issues
  for select to authenticated using (true);