-- 0026: Fix UPDATE permission untuk issue & works — user yang di-assign bisa complete/update.
-- Bug: user yang ada di issue_assignees tapi bukan assigned_to primary tidak bisa update issue.
-- Root cause: policy issues_update hanya cek assigned_to = auth.uid(), tidak cek issue_assignees.

-- ── issues UPDATE ───────────────────────────────────────────────────
drop policy if exists issues_update on public.issues;
create policy issues_update on public.issues
  for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_leader_of(assigned_team_id)
    or public.is_leader_of(reported_team_id)
    or exists (
      select 1 from public.issue_assignees a
      where a.issue_id = id and a.user_id = auth.uid()
    )
  )
  with check (true);

-- ── works UPDATE ────────────────────────────────────────────────────
-- Works hanya punya assigned_to tunggal (tidak ada multi-assignee seperti issue),
-- tapi untuk konsistensi kita pastikan policy tetap mengizinkan assigned_to untuk update.
drop policy if exists works_update on public.works;
create policy works_update on public.works
  for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_leader_of(team_id)
  )
  with check (true);
