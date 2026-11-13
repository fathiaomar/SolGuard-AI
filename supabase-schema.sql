<<<<<<< HEAD
-- Supabase schema for the Solidity smart-contract auditor.
-- Run in the Supabase SQL editor. Authentication is provided by Supabase Auth.

create extension if not exists pgcrypto;

-- User metadata kept separately from auth.users.
create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	avatar_url text,
	preferences jsonb not null default '{}'::jsonb
		constraint profiles_preferences_object_check
		check (jsonb_typeof(preferences) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles
	add column if not exists preferences jsonb not null default '{}'::jsonb;

do $$
begin
	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.profiles'::regclass
			and conname = 'profiles_preferences_object_check'
	) then
		alter table public.profiles
			add constraint profiles_preferences_object_check
			check (jsonb_typeof(preferences) = 'object');
	end if;
end;
$$;

create table if not exists public.projects (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	name text not null,
	description text,
	network text not null default 'Ethereum',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.projects
	add column if not exists network text not null default 'Ethereum';

create unique index if not exists projects_id_user_id_uidx
	on public.projects (id, user_id);

create table if not exists public.contracts (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	project_id uuid references public.projects (id) on delete set null,
	name text not null,
	source_code text not null
		constraint contracts_source_code_size_check
		check (octet_length(source_code) <= 512000),
	compiler_version text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	foreign key (project_id, user_id)
		references public.projects (id, user_id) on delete set null (project_id)
);

create unique index if not exists contracts_id_user_id_uidx
	on public.contracts (id, user_id);

create table if not exists public.audits (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	contract_id uuid,
	status text not null default 'pending'
		check (status in ('pending', 'running', 'completed', 'failed')),
	security_score integer check (security_score between 0 and 100),
	findings jsonb not null default '[]'::jsonb
		constraint audits_findings_array_check
		check (jsonb_typeof(findings) = 'array'),
	analysis jsonb not null default '{}'::jsonb
		constraint audits_analysis_object_check
		check (jsonb_typeof(analysis) = 'object'),
	scan_type text not null default 'Static AST pattern analysis',
	summary text,
	error_message text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	completed_at timestamptz
);

-- Add the contract relationship when upgrading an existing audits table.
alter table public.audits add column if not exists contract_id uuid;
alter table public.audits
	add column if not exists findings jsonb not null default '[]'::jsonb,
	add column if not exists analysis jsonb not null default '{}'::jsonb,
	add column if not exists scan_type text not null default 'Static AST pattern analysis';

do $$
begin
	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_findings_array_check'
	) then
		alter table public.audits
			add constraint audits_findings_array_check
			check (jsonb_typeof(findings) = 'array');
	end if;

	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.contracts'::regclass
			and conname = 'contracts_source_code_size_check'
	) then
		alter table public.contracts
			add constraint contracts_source_code_size_check
			check (octet_length(source_code) <= 512000);
	end if;

	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_analysis_object_check'
	) then
		alter table public.audits
			add constraint audits_analysis_object_check
			check (jsonb_typeof(analysis) = 'object');
	end if;
end;
$$;

create unique index if not exists audits_id_user_id_uidx
	on public.audits (id, user_id);

-- Preserve contracts stored directly on audits by the previous schema.
do $$
begin
	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'audits'
			and column_name = 'contract_name'
	) and exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'audits'
			and column_name = 'source_code'
	) then
		create temporary table audit_contract_migration on commit drop as
		select id as audit_id, gen_random_uuid() as contract_id
		from public.audits
		where contract_id is null;

		insert into public.contracts (id, user_id, name, source_code, compiler_version)
		select migration.contract_id, audits.user_id, audits.contract_name,
			audits.source_code, audits.compiler_version
		from audit_contract_migration as migration
		join public.audits as audits on audits.id = migration.audit_id;

		update public.audits as audits
		set contract_id = migration.contract_id
		from audit_contract_migration as migration
		where audits.id = migration.audit_id;

		drop table audit_contract_migration;
	end if;

	if exists (select 1 from public.audits where contract_id is null) then
		raise exception 'Cannot finish audits migration: existing audit rows need a contract. Add contract_name and source_code or assign contract_id values before rerunning.';
	end if;

	alter table public.audits alter column contract_id set not null;

	if not exists (
		select 1
		from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_contract_user_fkey'
	) then
		alter table public.audits
			add constraint audits_contract_user_fkey
			foreign key (contract_id, user_id)
			references public.contracts (id, user_id) on delete cascade;
	end if;
end;
$$;

-- Legacy audit rows have been moved to contracts; keep old columns optional.
do $$
declare
	legacy_column text;
begin
	foreach legacy_column in array array['contract_name', 'source_code', 'compiler_version']
	loop
		if exists (
			select 1
			from information_schema.columns
			where table_schema = 'public'
				and table_name = 'audits'
				and column_name = legacy_column
		) then
			execute format('alter table public.audits alter column %I drop not null', legacy_column);
		end if;
	end loop;
end;
$$;

create table if not exists public.reports (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	audit_id uuid not null,
	title text not null,
	content text,
	findings jsonb not null default '[]'::jsonb
		check (jsonb_typeof(findings) = 'array'),
	created_at timestamptz not null default now(),
	foreign key (audit_id, user_id)
		references public.audits (id, user_id) on delete cascade
);

create table if not exists public.ai_scan_requests (
	id bigint generated always as identity primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	requested_at timestamptz not null default now()
);

create index if not exists projects_user_created_idx
	on public.projects (user_id, created_at desc);
create index if not exists contracts_user_created_idx
	on public.contracts (user_id, created_at desc);
create index if not exists contracts_project_idx
	on public.contracts (project_id);
create index if not exists audits_user_created_idx
	on public.audits (user_id, created_at desc);
create index if not exists audits_contract_idx
	on public.audits (contract_id);
create index if not exists reports_audit_idx
	on public.reports (audit_id);
create index if not exists ai_scan_requests_user_requested_idx
	on public.ai_scan_requests (user_id, requested_at desc);

-- Keep updated_at current when rows change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
	before update on public.profiles
	for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
	before update on public.projects
	for each row execute function public.set_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
	before update on public.contracts
	for each row execute function public.set_updated_at();

drop trigger if exists audits_set_updated_at on public.audits;
create trigger audits_set_updated_at
	before update on public.audits
	for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, display_name, avatar_url)
	values (
		new.id,
		coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

insert into public.profiles (id, display_name, avatar_url)
select
	id,
	coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name'),
	raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.contracts enable row level security;
alter table public.audits enable row level security;
alter table public.reports enable row level security;
alter table public.ai_scan_requests enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
	on public.profiles for select
	using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
	on public.profiles for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

drop policy if exists "Users can manage their own projects" on public.projects;
create policy "Users can manage their own projects"
	on public.projects for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own contracts" on public.contracts;
create policy "Users can manage their own contracts"
	on public.contracts for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own audits" on public.audits;
create policy "Users can manage their own audits"
	on public.audits for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own reports" on public.reports;
create policy "Users can manage their own reports"
	on public.reports for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

revoke all on public.profiles, public.projects, public.contracts, public.audits, public.reports from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.contracts, public.audits, public.reports to authenticated;
revoke all on public.ai_scan_requests from anon, authenticated;

create or replace function public.delete_project_with_data(p_project_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
begin
	if current_user_id is null then
		raise exception 'Authentication required';
	end if;

	perform 1 from public.projects
	where id = p_project_id
		and user_id = current_user_id
	for update;
	if not found then
		return false;
	end if;

	delete from public.contracts
	where project_id = p_project_id
		and user_id = current_user_id;

	delete from public.projects
	where id = p_project_id
		and user_id = current_user_id;

	return true;
end;
$$;

revoke all on function public.delete_project_with_data(uuid) from public, anon;
grant execute on function public.delete_project_with_data(uuid) to authenticated;

create or replace function public.reserve_ai_scan()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
	request_count bigint;
begin
	if current_user_id is null then
		raise exception 'Authentication required';
	end if;

	perform pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended(current_user_id::text, 0)
	);

	select count(*) into request_count
	from public.ai_scan_requests
	where user_id = current_user_id
		and requested_at > pg_catalog.now() - interval '24 hours';

	if request_count >= 5 then
		return false;
	end if;

	insert into public.ai_scan_requests (user_id) values (current_user_id);
	return true;
end;
$$;

revoke all on function public.reserve_ai_scan() from public, anon;
grant execute on function public.reserve_ai_scan() to authenticated;
=======
-- Supabase schema for the Solidity smart-contract auditor.
-- Run in the Supabase SQL editor. Authentication is provided by Supabase Auth.

create extension if not exists pgcrypto;

-- User metadata kept separately from auth.users.
create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	avatar_url text,
	preferences jsonb not null default '{}'::jsonb
		constraint profiles_preferences_object_check
		check (jsonb_typeof(preferences) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles
	add column if not exists preferences jsonb not null default '{}'::jsonb;

do $$
begin
	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.profiles'::regclass
			and conname = 'profiles_preferences_object_check'
	) then
		alter table public.profiles
			add constraint profiles_preferences_object_check
			check (jsonb_typeof(preferences) = 'object');
	end if;
end;
$$;

create table if not exists public.projects (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	name text not null,
	description text,
	network text not null default 'Ethereum',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.projects
	add column if not exists network text not null default 'Ethereum';

create unique index if not exists projects_id_user_id_uidx
	on public.projects (id, user_id);

create table if not exists public.contracts (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	project_id uuid references public.projects (id) on delete set null,
	name text not null,
	source_code text not null
		constraint contracts_source_code_size_check
		check (octet_length(source_code) <= 512000),
	compiler_version text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	foreign key (project_id, user_id)
		references public.projects (id, user_id) on delete set null (project_id)
);

create unique index if not exists contracts_id_user_id_uidx
	on public.contracts (id, user_id);

create table if not exists public.audits (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	contract_id uuid,
	status text not null default 'pending'
		check (status in ('pending', 'running', 'completed', 'failed')),
	security_score integer check (security_score between 0 and 100),
	findings jsonb not null default '[]'::jsonb
		constraint audits_findings_array_check
		check (jsonb_typeof(findings) = 'array'),
	analysis jsonb not null default '{}'::jsonb
		constraint audits_analysis_object_check
		check (jsonb_typeof(analysis) = 'object'),
	scan_type text not null default 'Static AST pattern analysis',
	summary text,
	error_message text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	completed_at timestamptz
);

-- Add the contract relationship when upgrading an existing audits table.
alter table public.audits add column if not exists contract_id uuid;
alter table public.audits
	add column if not exists findings jsonb not null default '[]'::jsonb,
	add column if not exists analysis jsonb not null default '{}'::jsonb,
	add column if not exists scan_type text not null default 'Static AST pattern analysis';

do $$
begin
	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_findings_array_check'
	) then
		alter table public.audits
			add constraint audits_findings_array_check
			check (jsonb_typeof(findings) = 'array');
	end if;

	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.contracts'::regclass
			and conname = 'contracts_source_code_size_check'
	) then
		alter table public.contracts
			add constraint contracts_source_code_size_check
			check (octet_length(source_code) <= 512000);
	end if;

	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_analysis_object_check'
	) then
		alter table public.audits
			add constraint audits_analysis_object_check
			check (jsonb_typeof(analysis) = 'object');
	end if;
end;
$$;

create unique index if not exists audits_id_user_id_uidx
	on public.audits (id, user_id);

-- Preserve contracts stored directly on audits by the previous schema.
do $$
begin
	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'audits'
			and column_name = 'contract_name'
	) and exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'audits'
			and column_name = 'source_code'
	) then
		create temporary table audit_contract_migration on commit drop as
		select id as audit_id, gen_random_uuid() as contract_id
		from public.audits
		where contract_id is null;

		insert into public.contracts (id, user_id, name, source_code, compiler_version)
		select migration.contract_id, audits.user_id, audits.contract_name,
			audits.source_code, audits.compiler_version
		from audit_contract_migration as migration
		join public.audits as audits on audits.id = migration.audit_id;

		update public.audits as audits
		set contract_id = migration.contract_id
		from audit_contract_migration as migration
		where audits.id = migration.audit_id;

		drop table audit_contract_migration;
	end if;

	if exists (select 1 from public.audits where contract_id is null) then
		raise exception 'Cannot finish audits migration: existing audit rows need a contract. Add contract_name and source_code or assign contract_id values before rerunning.';
	end if;

	alter table public.audits alter column contract_id set not null;

	if not exists (
		select 1
		from pg_constraint
		where conrelid = 'public.audits'::regclass
			and conname = 'audits_contract_user_fkey'
	) then
		alter table public.audits
			add constraint audits_contract_user_fkey
			foreign key (contract_id, user_id)
			references public.contracts (id, user_id) on delete cascade;
	end if;
end;
$$;

-- Legacy audit rows have been moved to contracts; keep old columns optional.
do $$
declare
	legacy_column text;
begin
	foreach legacy_column in array array['contract_name', 'source_code', 'compiler_version']
	loop
		if exists (
			select 1
			from information_schema.columns
			where table_schema = 'public'
				and table_name = 'audits'
				and column_name = legacy_column
		) then
			execute format('alter table public.audits alter column %I drop not null', legacy_column);
		end if;
	end loop;
end;
$$;

create table if not exists public.reports (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	audit_id uuid not null,
	title text not null,
	content text,
	findings jsonb not null default '[]'::jsonb
		check (jsonb_typeof(findings) = 'array'),
	created_at timestamptz not null default now(),
	foreign key (audit_id, user_id)
		references public.audits (id, user_id) on delete cascade
);

create table if not exists public.ai_scan_requests (
	id bigint generated always as identity primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	requested_at timestamptz not null default now()
);

create index if not exists projects_user_created_idx
	on public.projects (user_id, created_at desc);
create index if not exists contracts_user_created_idx
	on public.contracts (user_id, created_at desc);
create index if not exists contracts_project_idx
	on public.contracts (project_id);
create index if not exists audits_user_created_idx
	on public.audits (user_id, created_at desc);
create index if not exists audits_contract_idx
	on public.audits (contract_id);
create index if not exists reports_audit_idx
	on public.reports (audit_id);
create index if not exists ai_scan_requests_user_requested_idx
	on public.ai_scan_requests (user_id, requested_at desc);

-- Keep updated_at current when rows change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
	before update on public.profiles
	for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
	before update on public.projects
	for each row execute function public.set_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
	before update on public.contracts
	for each row execute function public.set_updated_at();

drop trigger if exists audits_set_updated_at on public.audits;
create trigger audits_set_updated_at
	before update on public.audits
	for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, display_name, avatar_url)
	values (
		new.id,
		coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

insert into public.profiles (id, display_name, avatar_url)
select
	id,
	coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name'),
	raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.contracts enable row level security;
alter table public.audits enable row level security;
alter table public.reports enable row level security;
alter table public.ai_scan_requests enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
	on public.profiles for select
	using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
	on public.profiles for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

drop policy if exists "Users can manage their own projects" on public.projects;
create policy "Users can manage their own projects"
	on public.projects for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own contracts" on public.contracts;
create policy "Users can manage their own contracts"
	on public.contracts for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own audits" on public.audits;
create policy "Users can manage their own audits"
	on public.audits for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own reports" on public.reports;
create policy "Users can manage their own reports"
	on public.reports for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

revoke all on public.profiles, public.projects, public.contracts, public.audits, public.reports from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.contracts, public.audits, public.reports to authenticated;
revoke all on public.ai_scan_requests from anon, authenticated;

create or replace function public.delete_project_with_data(p_project_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
begin
	if current_user_id is null then
		raise exception 'Authentication required';
	end if;

	perform 1 from public.projects
	where id = p_project_id
		and user_id = current_user_id
	for update;
	if not found then
		return false;
	end if;

	delete from public.contracts
	where project_id = p_project_id
		and user_id = current_user_id;

	delete from public.projects
	where id = p_project_id
		and user_id = current_user_id;

	return true;
end;
$$;

revoke all on function public.delete_project_with_data(uuid) from public, anon;
grant execute on function public.delete_project_with_data(uuid) to authenticated;

create or replace function public.reserve_ai_scan()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := auth.uid();
	request_count bigint;
begin
	if current_user_id is null then
		raise exception 'Authentication required';
	end if;

	perform pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtextextended(current_user_id::text, 0)
	);

	select count(*) into request_count
	from public.ai_scan_requests
	where user_id = current_user_id
		and requested_at > pg_catalog.now() - interval '24 hours';

	if request_count >= 5 then
		return false;
	end if;

	insert into public.ai_scan_requests (user_id) values (current_user_id);
	return true;
end;
$$;

revoke all on function public.reserve_ai_scan() from public, anon;
grant execute on function public.reserve_ai_scan() to authenticated;
>>>>>>> 7940fba658c6c72afbc060d3d00fe805b6ced0e4
