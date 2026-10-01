-- 0013: Fix notifications RLS — ensure insert works for authenticated users
-- Error: "new row violates row-level security policy for table notifications"

-- Drop existing if any
drop policy if exists notifications_insert on public.notifications;

-- Create insert policy — allow authenticated users to insert notifications
create policy notifications_insert on public.notifications
  for insert to authenticated with check (true);

-- Ensure select/update/delete policies are correct
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (for_user = auth.uid() or for_user is null);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (for_user = auth.uid() or for_user is null) with check (true);

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (for_user = auth.uid() or public.is_admin());