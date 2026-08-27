-- Each authenticated account owns one private chore board. Team members are
-- people on that board and do not need separate authentication accounts.

revoke all on table public."chore app" from anon, authenticated;

alter table public.team_members
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists avatar_url text,
  add column if not exists email text,
  add column if not exists skills text[],
  add column if not exists working_hours_start time,
  add column if not exists working_hours_end time,
  add column if not exists working_days integer[],
  add column if not exists points integer not null default 0,
  add column if not exists badges text[],
  add column if not exists weekly_capacity_minutes integer;

alter table public.chores
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists description text,
  add column if not exists due_time time,
  add column if not exists priority text not null default 'medium',
  add column if not exists category_id uuid,
  add column if not exists estimated_minutes integer;

do $$
declare
  legacy_owner_id uuid;
begin
  select id into legacy_owner_id
  from auth.users
  where lower(email) = lower('lizhen02@gmail.com');

  if legacy_owner_id is null then
    raise exception 'Legacy owner account was not found';
  end if;

  update public.team_members set owner_id = legacy_owner_id where owner_id is null;
  update public.chores set owner_id = legacy_owner_id where owner_id is null;
end $$;

alter table public.team_members alter column owner_id set default auth.uid();
alter table public.team_members alter column owner_id set not null;
alter table public.chores alter column owner_id set default auth.uid();
alter table public.chores alter column owner_id set not null;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chore_id uuid not null,
  instance_date date not null,
  completed_by uuid not null,
  completed_at timestamptz not null default now(),
  notes text,
  unique (chore_id, instance_date)
);

create table if not exists public.member_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint member_availability_dates_valid check (end_date >= start_date)
);

alter table public.team_members drop constraint if exists team_members_id_owner_key;
alter table public.team_members add constraint team_members_id_owner_key unique (id, owner_id);
alter table public.chores drop constraint if exists chores_id_owner_key;
alter table public.chores add constraint chores_id_owner_key unique (id, owner_id);

alter table public.chores drop constraint if exists chores_assignee_id_fkey;
alter table public.chores drop constraint if exists chores_assignee_owner_fkey;
alter table public.chores add constraint chores_assignee_owner_fkey
  foreign key (assignee_id, owner_id) references public.team_members(id, owner_id) on delete set null (assignee_id);
alter table public.chores drop constraint if exists chores_category_owner_fkey;
alter table public.chores add constraint chores_category_owner_fkey
  foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete set null (category_id);

alter table public.chore_completions drop constraint if exists chore_completions_chore_owner_fkey;
alter table public.chore_completions add constraint chore_completions_chore_owner_fkey
  foreign key (chore_id, owner_id) references public.chores(id, owner_id) on delete cascade;
alter table public.chore_completions drop constraint if exists chore_completions_member_owner_fkey;
alter table public.chore_completions add constraint chore_completions_member_owner_fkey
  foreign key (completed_by, owner_id) references public.team_members(id, owner_id) on delete cascade;

alter table public.member_availability drop constraint if exists member_availability_member_owner_fkey;
alter table public.member_availability add constraint member_availability_member_owner_fkey
  foreign key (member_id, owner_id) references public.team_members(id, owner_id) on delete cascade;

create index if not exists team_members_owner_idx on public.team_members(owner_id);
create index if not exists chores_owner_date_idx on public.chores(owner_id, date);
create index if not exists chores_assignee_owner_idx on public.chores(assignee_id, owner_id);
create index if not exists chores_category_owner_idx on public.chores(category_id, owner_id);
create index if not exists categories_owner_idx on public.categories(owner_id);
create index if not exists chore_completions_owner_idx on public.chore_completions(owner_id);
create index if not exists chore_completions_chore_owner_idx on public.chore_completions(chore_id, owner_id);
create index if not exists chore_completions_member_owner_idx on public.chore_completions(completed_by, owner_id);
create index if not exists member_availability_owner_idx on public.member_availability(owner_id);
create index if not exists member_availability_member_owner_idx on public.member_availability(member_id, owner_id);

alter table public.team_members enable row level security;
alter table public.chores enable row level security;
alter table public.categories enable row level security;
alter table public.chore_completions enable row level security;
alter table public.member_availability enable row level security;

drop policy if exists "Public access" on public.team_members;
drop policy if exists "Public access" on public.chores;
drop policy if exists team_members_owner_access on public.team_members;
create policy team_members_owner_access on public.team_members for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists chores_owner_access on public.chores;
create policy chores_owner_access on public.chores for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists categories_owner_access on public.categories;
create policy categories_owner_access on public.categories for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists chore_completions_owner_access on public.chore_completions;
create policy chore_completions_owner_access on public.chore_completions for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists member_availability_owner_access on public.member_availability;
create policy member_availability_owner_access on public.member_availability for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on public.team_members, public.chores, public.categories,
  public.chore_completions, public.member_availability from anon;
grant select, insert, update, delete on public.team_members, public.chores,
  public.categories, public.chore_completions, public.member_availability to authenticated;
