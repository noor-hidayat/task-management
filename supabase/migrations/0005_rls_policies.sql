-- 0005: Row Level Security policies

alter table public.teams            enable row level security;
alter table public.shifts           enable row level security;
alter table public.profiles         enable row level security;
alter table public.schedules        enable row level security;
alter table public.core_works       enable row level security;
alter table public.works            enable row level security;
alter table public.work_checklist   enable row level security;
alter table public.issues           enable row level security;
alter table public.issue_assignees  enable row level security;
alter table public.issue_handovers  enable row level security;
alter table public.attachments      enable row level security;
alter table public.comments         enable row level security;
alter table public.activities       enable row level security;
alter table public.notifications    enable row level security;

-- ── teams ──────────────────────────────────────────────────────
-- Semua user login boleh melihat daftar tim.
create policy teams_select on public.teams
  for select to authenticated using (true);
create policy teams_admin_write on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy teams_leader_update on public.teams
  for update to authenticated
  using (public.is_leader_of(id)) with check (public.is_leader_of(id));

-- ── shifts ─────────────────────────────────────────────────────
create policy shifts_select on public.shifts
  for select to authenticated using (true);
create policy shifts_admin_write on public.shifts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── profiles ───────────────────────────────────────────────────
-- Lihat profil sendiri; admin/leader lihat semua; member lihat rekan setim.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_leader()
    or team_id = public.my_team_id()
  );
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── schedules ──────────────────────────────────────────────────
create policy schedules_select on public.schedules
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_leader());
create policy schedules_write on public.schedules
  for all to authenticated
  using (user_id = auth.uid() or public.is_leader())
  with check (user_id = auth.uid() or public.is_leader());

-- ── core_works ─────────────────────────────────────────────────
create policy core_works_select on public.core_works
  for select to authenticated
  using (team_id = public.my_team_id() or public.is_admin() or public.is_leader());
create policy core_works_write on public.core_works
  for all to authenticated
  using (public.is_leader_of(team_id)) with check (public.is_leader_of(team_id));

-- ── works ──────────────────────────────────────────────────────
create policy works_select on public.works
  for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or team_id = public.my_team_id()
  );
create policy works_insert on public.works
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_leader());
create policy works_update on public.works
  for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_leader_of(team_id)
  )
  with check (true);
create policy works_delete on public.works
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid() or public.is_leader_of(team_id));

-- ── work_checklist ─────────────────────────────────────────────
create policy work_checklist_select on public.work_checklist
  for select to authenticated using (public.can_read_work(work_id));
create policy work_checklist_write on public.work_checklist
  for all to authenticated
  using (public.can_read_work(work_id)) with check (public.can_read_work(work_id));

-- ── issues ─────────────────────────────────────────────────────
create policy issues_select on public.issues
  for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or reported_team_id = public.my_team_id()
    or assigned_team_id = public.my_team_id()
    or exists (
      select 1 from public.issue_assignees a
      where a.issue_id = id and a.user_id = auth.uid()
    )
  );
create policy issues_insert on public.issues
  for insert to authenticated with check (created_by = auth.uid() or public.is_leader());
create policy issues_update on public.issues
  for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_leader_of(assigned_team_id)
    or public.is_leader_of(reported_team_id)
  )
  with check (true);
create policy issues_delete on public.issues
  for delete to authenticated using (public.is_admin() or public.is_leader());

-- ── issue_assignees ────────────────────────────────────────────
create policy issue_assignees_select on public.issue_assignees
  for select to authenticated using (public.can_read_issue(issue_id));
create policy issue_assignees_write on public.issue_assignees
  for all to authenticated
  using (public.can_read_issue(issue_id)) with check (public.can_read_issue(issue_id));

-- ── issue_handovers ────────────────────────────────────────────
create policy issue_handovers_select on public.issue_handovers
  for select to authenticated using (public.can_read_issue(issue_id));
create policy issue_handovers_insert on public.issue_handovers
  for insert to authenticated with check (public.can_read_issue(issue_id));
create policy issue_handovers_delete on public.issue_handovers
  for delete to authenticated using (public.is_admin() or public.is_leader());

-- ── attachments ────────────────────────────────────────────────
-- Baca bila bisa membaca entitas induknya.
create policy attachments_select on public.attachments
  for select to authenticated
  using (
    (owner_type = 'work' and public.can_read_work(owner_id))
    or (owner_type = 'issue' and public.can_read_issue(owner_id))
  );
create policy attachments_insert on public.attachments
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy attachments_delete on public.attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_leader());

-- ── comments ───────────────────────────────────────────────────
create policy comments_select on public.comments
  for select to authenticated
  using (
    (owner_type = 'work' and public.can_read_work(owner_id))
    or (owner_type = 'issue' and public.can_read_issue(owner_id))
  );
create policy comments_insert on public.comments
  for insert to authenticated with check (author_id = auth.uid());
create policy comments_delete on public.comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- ── activities ─────────────────────────────────────────────────
create policy activities_select on public.activities
  for select to authenticated
  using (
    (owner_type = 'work' and public.can_read_work(owner_id))
    or (owner_type = 'issue' and public.can_read_issue(owner_id))
  );
create policy activities_insert on public.activities
  for insert to authenticated with check (actor_id = auth.uid());

-- ── notifications ──────────────────────────────────────────────
create policy notifications_select on public.notifications
  for select to authenticated using (for_user = auth.uid() or for_user is null);
create policy notifications_insert on public.notifications
  for insert to authenticated with check (true);
create policy notifications_update on public.notifications
  for update to authenticated
  using (for_user = auth.uid() or for_user is null) with check (true);
create policy notifications_delete on public.notifications
  for delete to authenticated using (for_user = auth.uid() or public.is_admin());
