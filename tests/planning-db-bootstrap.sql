\set ON_ERROR_STOP on
-- Run only against an empty, disposable PostgreSQL database.
do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role bypassrls; end if; end $$;
create publication supabase_realtime;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
\ir ../supabase/migrations/20261020000100_schema.sql
\ir ../supabase/migrations/20261020000200_helpers_rls.sql
\ir ../supabase/migrations/20261020000300_triggers_rpcs.sql
\ir ../supabase/migrations/20261020000400_defaults.sql
\ir ../supabase/migrations/20261020000600_directory.sql
create table public.research_runs(id uuid primary key,workspace_id uuid,idea_ids uuid[]);
\ir ../supabase/migrations/20261023000400_idea_brief.sql
alter table public.accounts add column contact_name text not null default '';
alter table public.workspace_settings add column ai_provider text;
-- Only the schema needed by the handoff, avoiding unrelated provider/cron setup.
alter table public.projects add column brief text;
alter table public.project_assets add column mime_type text, add column size_bytes bigint;
alter table public.project_statuses add column editors_can_set boolean default false;
create table public.project_checklist(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id),label text,sort integer);
alter table public.project_checklist enable row level security;
\ir ../supabase/migrations/20261106000100_manager_role.sql
\ir ../supabase/migrations/20261106000200_manager_permissions.sql
\ir ../supabase/migrations/20261106000300_idea_production_package.sql
\ir ../supabase/migrations/20261106000400_grok_integration.sql
grant usage on schema public,auth,app to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;
grant usage on all sequences in schema public to authenticated;
