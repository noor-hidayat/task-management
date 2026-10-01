-- 0025: Migrate team 2a615f9e-db20-4d5c-8705-9553d5d5af46 to 28719266-d180-4161-9b84-e98af884483f

-- Update profiles
update public.profiles
set team_id = '28719266-d180-4161-9b84-e98af884483f'
where team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update core_works
update public.core_works
set team_id = '28719266-d180-4161-9b84-e98af884483f'
where team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update works
update public.works
set team_id = '28719266-d180-4161-9b84-e98af884483f'
where team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update issues (reported_team_id)
update public.issues
set reported_team_id = '28719266-d180-4161-9b84-e98af884483f'
where reported_team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update issues (assigned_team_id)
update public.issues
set assigned_team_id = '28719266-d180-4161-9b84-e98af884483f'
where assigned_team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update issue_handovers (from_team_id)
update public.issue_handovers
set from_team_id = '28719266-d180-4161-9b84-e98af884483f'
where from_team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Update issue_handovers (to_team_id)
update public.issue_handovers
set to_team_id = '28719266-d180-4161-9b84-e98af884483f'
where to_team_id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';

-- Delete old team
delete from public.teams
where id = '2a615f9e-db20-4d5c-8705-9553d5d5af46';
