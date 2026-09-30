-- 0004: Helper functions untuk RLS
-- Semua SECURITY DEFINER + search_path kosong agar aman & menghindari rekursi policy.

create or replace function public.current_profile_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_team_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_leader()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('admin','leader') from public.profiles where id = auth.uid()), false);
$$;

-- Leader dari tim tertentu (atau admin).
create or replace function public.is_leader_of(target_team uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid())
    or (select role = 'leader' from public.profiles where id = auth.uid())
       and target_team is not null
       and target_team = (select team_id from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Cek apakah user tergabung/terkait sebuah work (untuk policy read).
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
      )
  );
$$;

-- Cek apakah user tergabung/terkait sebuah issue.
create or replace function public.can_read_issue(i_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.issues i
    where i.id = i_id
      and (
        public.is_admin()
        or i.assigned_to = auth.uid()
        or i.created_by = auth.uid()
        or i.reported_team_id = public.my_team_id()
        or i.assigned_team_id = public.my_team_id()
        or exists (
          select 1 from public.issue_assignees a
          where a.issue_id = i.id and a.user_id = auth.uid()
        )
      )
  );
$$;
