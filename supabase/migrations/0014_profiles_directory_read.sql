-- 0014: Allow all authenticated users to read profile directory.
-- Needed for assignee pickers, mention autocomplete, and notifyMentions.
-- Profiles only contain id/name/username/role/team (no secrets; passwords live in auth.users).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
