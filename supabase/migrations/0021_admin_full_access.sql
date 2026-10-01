-- 0021: Administrator full access on all app tables.
-- One permissive FOR ALL policy per table; combines with OR with existing policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'teams', 'shifts', 'profiles', 'schedules', 'core_works',
    'works', 'work_checklist', 'issues', 'issue_assignees', 'issue_handovers',
    'attachments', 'comments', 'activities', 'notifications',
    'plants', 'locations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;
