-- 0001: Extensions & enum types
-- Selaras dengan src/types/index.ts

create extension if not exists "pgcrypto";

-- Enum yang dipakai lintas tabel.
do $$ begin
  create type work_status as enum ('todo', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type as enum ('core', 'adhoc');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_status as enum ('open', 'in_progress', 'on_hold', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'leader', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type core_work_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'assignment', 'mention', 'progress', 'overdue', 'comment', 'handover'
  );
exception when duplicate_object then null; end $$;

-- Jenis pemilik entitas yang bisa punya attachment/comment/activity.
do $$ begin
  create type owner_kind as enum ('work', 'issue');
exception when duplicate_object then null; end $$;
