-- 0020: Allow assignee to delete their task.
drop policy if exists works_delete on public.works;
create policy works_delete on public.works
  for delete to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_leader_of(team_id)
  );
