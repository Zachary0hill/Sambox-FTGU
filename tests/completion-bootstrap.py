from pathlib import Path
r=Path(__file__).resolve().parents[1]
s=(r/'tests/planning-db-bootstrap.sql').read_text().split('\\ir ../supabase/migrations/20261020000100_schema.sql')[0]
s+='''
alter table auth.users add column last_sign_in_at timestamptz, add column banned_until timestamptz;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated,service_role;
alter default privileges in schema public grant usage on sequences to authenticated,service_role;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid,factor_type text,status text);
create schema vault;
create table vault.secrets(id uuid primary key default gen_random_uuid(),name text,secret text,description text);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(text,text,text default '') returns uuid language plpgsql as $$ declare x uuid; begin insert into vault.secrets(secret,name,description) values($1,$2,$3) returning id into x; return x; end $$;
create function vault.update_secret(uuid,text) returns void language sql as $$ update vault.secrets set secret=$2 where id=$1 $$;
create schema cron;
create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';
'''
# Production-specific schedules external extensions omitted. All application schema, triggers and RLS are real.
for f in sorted((r/'supabase/migrations').glob('*.sql')):
 if f.name=='20261026000200_scheduler.sql':continue
 if f.name=='20261111001500_canonical_assignments.sql': s+='\n'+(r/'tests/completion-fixtures.sql').read_text()+'\n'
 s+='\n\\echo '+f.name+'\n'+'BEGIN;\n'+f.read_text()+'\nCOMMIT;\n'
s+='\ngrant usage on schema public,auth,app,storage to authenticated,service_role;\n\ngrant execute on all functions in schema auth to authenticated;\ngrant all on all tables in schema public to service_role;\ngrant usage on all sequences in schema public to authenticated,service_role;\n'
print(s)
