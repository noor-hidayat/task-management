-- 0016: Open SELECT on child tables for all authenticated users.
-- Follows 0012 (works/issues readable by everyone): a task visible to a user
-- must also show its checklist, comments, activities, attachments, handovers.
-- Write policies (insert/update/delete) are unchanged.
drop policy if exists work_checklist_select on public.work_checklist;
create policy work_checklist_select on public.work_checklist
  for select to authenticated using (true);

drop policy if exists issue_handovers_select on public.issue_handovers;
create policy issue_handovers_select on public.issue_handovers
  for select to authenticated using (true);

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated using (true);

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (true);

drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated using (true);
