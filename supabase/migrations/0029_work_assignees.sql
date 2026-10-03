-- 0029: Multi-assignee untuk works (task) — junction seperti issue_assignees.
-- Tujuan: task dengan banyak assignee masuk ke My Work masing-masing user
-- yang di-assign (bukan hanya assigned_to primer).

-- ── Tabel junction ───────────────────────────────────────────────────
create table if not exists public.work_assignees (
  work_id uuid not null references public.works (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (work_id, user_id)
);

create index if not exists work_assignees_user_id_idx on public.work_assignees (user_id);

alter table public.work_assignees enable row level security;

-- Backfill: assignee primer yang sudah ada -> junction (idempoten).
insert into public.work_assignees (work_id, user_id)
select id, assigned_to from public.works where assigned_to is not null
on conflict do nothing;

-- Grant eksplisit (tabel baru tidak tercakup grant ALL TABLES di 0007).
grant select, insert, update, delete on public.work_assignees to authenticated;

-- ── Helper baca ikut junction ─────────────────────────────────────────
create or replace function public.can_read_work(w_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.works w
    where w.id = w_id
      and (
        public.is_admin()
        or w.assigned_to = auth.uid()
        or w.created_by = auth.uid()
        or w.team_id = public.my_team_id()
        or exists (
          select 1 from public.work_assignees a
          where a.work_id = w.id and a.user_id = auth.uid()
        )
      )
  );
$$;

-- ── RLS work_assignees (cermin issue_assignees) ───────────────────────
drop policy if exists work_assignees_select on public.work_assignees;
create policy work_assignees_select on public.work_assignees
  for select to authenticated using (public.can_read_work(work_id));

drop policy if exists work_assignees_write on public.work_assignees;
create policy work_assignees_write on public.work_assignees
  for all to authenticated
  using (public.can_read_work(work_id)) with check (public.can_read_work(work_id));

-- ── works SELECT: assignee non-primer bisa melihat baris work ─────────
drop policy if exists works_select on public.works;
create policy works_select on public.works
  for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or team_id = public.my_team_id()
    or exists (
      select 1 from public.work_assignees a
      where a.work_id = id and a.user_id = auth.uid()
    )
  );

-- ── works UPDATE: assignee non-primer bisa complete/update (cermin 0026) ──
drop policy if exists works_update on public.works;
create policy works_update on public.works
  for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or exists (
      select 1 from public.work_assignees a
      where a.work_id = id and a.user_id = auth.uid()
    )
    or public.is_leader_of(team_id)
  )
  with check (true);

-- ── Realtime untuk work_assignees (idempoten; abaikan bila dikelola dashboard) ──
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'work_assignees'
     ) then
    alter publication supabase_realtime add table public.work_assignees;
  end if;
end $$;
