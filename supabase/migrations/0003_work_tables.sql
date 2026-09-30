-- 0003: Tabel pekerjaan — core_works, works, checklist, issues, handovers,
--       attachments, comments, activities, notifications

-- ── Definisi core work (template pekerjaan rutin) ──────────────
create table if not exists public.core_works (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text default '',
  team_id           uuid references public.teams (id) on delete set null,
  frequency         text default '',
  schedule          text default '',
  evidence_required boolean not null default false,
  checklist         jsonb not null default '[]'::jsonb, -- string[]
  status            core_work_status not null default 'active',
  today_instance    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Works (task core maupun adhoc) ─────────────────────────────
create table if not exists public.works (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique,
  title             text not null,
  type              task_type not null default 'adhoc',
  status            work_status not null default 'todo',
  priority          priority not null default 'medium',
  created_by        uuid references public.profiles (id) on delete set null,
  assigned_to       uuid references public.profiles (id) on delete set null,
  team_id           uuid references public.teams (id) on delete set null,
  shift             text default '',
  due_date          text default '',
  description       text default '',
  progress          integer not null default 0 check (progress between 0 and 100),
  evidence_required boolean not null default false,
  cancelled         boolean not null default false,
  note              text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists works_assigned_to_idx on public.works (assigned_to);
create index if not exists works_team_id_idx on public.works (team_id);
create index if not exists works_status_idx on public.works (status);

create table if not exists public.work_checklist (
  id       uuid primary key default gen_random_uuid(),
  work_id  uuid not null references public.works (id) on delete cascade,
  label    text not null,
  done     boolean not null default false,
  position integer not null default 0
);

create index if not exists work_checklist_work_id_idx on public.work_checklist (work_id);

-- ── Issues ─────────────────────────────────────────────────────
create table if not exists public.issues (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  title            text not null,
  description      text default '',
  status           issue_status not null default 'open',
  priority         priority not null default 'medium',
  created_by       uuid references public.profiles (id) on delete set null,
  assigned_to      uuid references public.profiles (id) on delete set null,
  reported_team_id uuid references public.teams (id) on delete set null,
  assigned_team_id uuid references public.teams (id) on delete set null,
  plant            text default '',
  location         text default '',
  due_date         text default '',
  resolution       text,
  closed_by        uuid references public.profiles (id) on delete set null,
  closed_at        timestamptz,
  hold_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists issues_assigned_to_idx on public.issues (assigned_to);
create index if not exists issues_assigned_team_id_idx on public.issues (assigned_team_id);
create index if not exists issues_status_idx on public.issues (status);

-- Multi-assignee untuk issue.
create table if not exists public.issue_assignees (
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (issue_id, user_id)
);

-- Riwayat serah terima antar tim.
create table if not exists public.issue_handovers (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.issues (id) on delete cascade,
  from_team_id  uuid references public.teams (id) on delete set null,
  to_team_id    uuid references public.teams (id) on delete set null,
  actor_id      uuid references public.profiles (id) on delete set null,
  note          text,
  at            timestamptz not null default now()
);

create index if not exists issue_handovers_issue_id_idx on public.issue_handovers (issue_id);

-- ── Attachments (file di Google Drive) ─────────────────────────
-- dataUrl lama digantikan drive_file_id + drive_folder_id.
create table if not exists public.attachments (
  id              uuid primary key default gen_random_uuid(),
  owner_type      owner_kind not null,
  owner_id        uuid not null,
  drive_file_id   text not null,
  drive_folder_id text,
  file_name       text not null,
  file_type       text default '',
  file_size       text default '',
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists attachments_owner_idx on public.attachments (owner_type, owner_id);

-- ── Comments ───────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  owner_type owner_kind not null,
  owner_id   uuid not null,
  author_id  uuid references public.profiles (id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_owner_idx on public.comments (owner_type, owner_id);

-- ── Activities (feed) ──────────────────────────────────────────
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  owner_type owner_kind not null,
  owner_id   uuid not null,
  text       text not null,
  actor_id   uuid references public.profiles (id) on delete set null,
  at         timestamptz not null default now()
);

create index if not exists activities_owner_idx on public.activities (owner_type, owner_id);

-- ── Notifications ──────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  type       notification_type not null,
  title      text not null,
  message    text default '',
  from_id    uuid references public.profiles (id) on delete set null,
  for_user   uuid references public.profiles (id) on delete cascade, -- null = broadcast
  link       text default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_for_user_idx on public.notifications (for_user);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
