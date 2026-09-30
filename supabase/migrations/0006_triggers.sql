-- 0006: Triggers — auto onboarding user, penomoran, updated_at, activity

-- ── updated_at otomatis ────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['teams','profiles','core_works','works','issues']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_touch on public.%1$s;
       create trigger trg_%1$s_touch before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ── Auto-create profile saat user auth baru dibuat ─────────────
-- Metadata yang diharapkan: name, username, role, initials, team_id, shift.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, username, initials, role, team_id, shift)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'initials',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'member'),
    nullif(new.raw_user_meta_data ->> 'team_id', '')::uuid,
    new.raw_user_meta_data ->> 'shift'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Penomoran otomatis ─────────────────────────────────────────
-- TK-MMYY{nnnn} (adhoc work), CW-YYYY-031 (core work), ISS-MMYY{nnnn} (issue).
create sequence if not exists public.work_adhoc_seq start 1;
create sequence if not exists public.work_core_seq  start 31;
create sequence if not exists public.issue_seq      start 1;

create or replace function public.set_work_number()
returns trigger language plpgsql as $$
declare mmyy text := to_char(now(), 'MMYY');
begin
  if new.number is null or new.number = '' then
    if new.type = 'core' then
      new.number := 'CW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.work_core_seq')::text, 3, '0');
    else
      new.number := 'TK-' || mmyy || lpad(nextval('public.work_adhoc_seq')::text, 4, '0');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_work_number on public.works;
create trigger trg_work_number
  before insert on public.works
  for each row execute function public.set_work_number();

create or replace function public.set_issue_number()
returns trigger language plpgsql as $$
declare mmyy text := to_char(now(), 'MMYY');
begin
  if new.number is null or new.number = '' then
    new.number := 'ISS-' || mmyy || lpad(nextval('public.issue_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_issue_number on public.issues;
create trigger trg_issue_number
  before insert on public.issues
  for each row execute function public.set_issue_number();

-- ── Handover awal saat issue dibuat ────────────────────────────
create or replace function public.log_issue_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reported_team_id is not null then
    insert into public.issue_handovers (issue_id, to_team_id, actor_id, at)
    values (new.id, new.reported_team_id, new.created_by, new.created_at);
  end if;
  insert into public.activities (owner_type, owner_id, text, actor_id, at)
  values ('issue', new.id, 'reported issue', new.created_by, new.created_at);
  return new;
end $$;

drop trigger if exists trg_issue_created on public.issues;
create trigger trg_issue_created
  after insert on public.issues
  for each row execute function public.log_issue_created();
