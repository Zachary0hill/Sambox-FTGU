-- Require a completed challenge only when this user has enrolled a verified factor.
-- Service-role jobs retain their existing server authorization; setup/challenge stays in Supabase Auth.
create or replace function app.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (coalesce(auth.jwt()->>'aal','aal1')='aal2' or not exists(
 select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
$$;
revoke all on function app.mfa_satisfied() from public,anon;
grant execute on function app.mfa_satisfied() to authenticated,service_role;
create or replace function app.require_verified_session() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')='authenticated' and not app.mfa_satisfied() then
 raise exception 'Complete two-step sign in before accessing studio data' using errcode='42501';
 end if;
end $$;
revoke all on function app.require_verified_session() from public,anon;
grant execute on function app.require_verified_session() to authenticated,service_role;

-- Restrictive policies AND with existing tenant/role policies; do not replace those policies.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or (n.nspname='storage' and c.relname='objects')) loop
 execute format('create policy require_verified_mfa on %I.%I as restrictive for all to authenticated using ((select app.mfa_satisfied())) with check ((select app.mfa_satisfied()))',t.nspname,t.relname);
 end loop;
end $$;

-- SECURITY DEFINER RPCs bypass table RLS. Guard every currently exposed RPC without changing its signature,
-- grants, existing tenant authorization or result. Future definer RPCs must call the same guard.
do $$ declare f record; definition text; guarded text; begin
 for f in select p.oid,p.prosrc,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and p.prosecdef and p.prokind='f' and has_function_privilege('authenticated',p.oid,'EXECUTE')
 loop
 if f.prosrc like '%app.require_verified_session()%' then continue; end if;
 if f.lanname='sql' then guarded := 'select app.require_verified_session();' || chr(10) || f.prosrc;
 elsif f.lanname='plpgsql' then
   guarded := regexp_replace(f.prosrc,'\mbegin\M',E'begin\n  perform app.require_verified_session();','i');
   if guarded=f.prosrc then raise exception 'Cannot guard RPC %',f.oid::regprocedure; end if;
 else raise exception 'Unsupported exposed definer RPC %',f.oid::regprocedure;
 end if;
 definition := pg_get_functiondef(f.oid);
 execute replace(definition,f.prosrc,guarded);
 end loop;
end $$;
