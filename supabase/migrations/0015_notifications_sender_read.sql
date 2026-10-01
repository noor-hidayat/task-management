-- 0015: Allow notification sender to read rows they created.
-- pushNotification does insert().select() (RETURNING), which requires SELECT
-- permission on the new row. Previously only the recipient (for_user) could
-- select it, so every app-created notification failed with 42501 for non-admins.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (
    for_user = auth.uid() or for_user is null or from_id = auth.uid()
  );
