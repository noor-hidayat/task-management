-- 0028: RLS policies untuk issue_types
alter table public.issue_types enable row level security;

-- Semua user bisa read issue_types (master data)
create policy "Everyone can view issue types"
  on public.issue_types for select
  to authenticated
  using (true);

-- Hanya admin yang bisa insert/update/delete issue types
create policy "Admin can manage issue types"
  on public.issue_types for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
