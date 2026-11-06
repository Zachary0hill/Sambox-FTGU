\set ON_ERROR_STOP on
-- Run after planning-db-bootstrap.sql and planning-db.sql in a disposable database only.
begin;
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
update public.role_permissions set allowed=true where role='manager' and resource='ideas' and action in ('view','create','edit','approve');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';

insert into public.ideas(id,workspace_id,brand_id,title,body,refs,author_id,status,title_options,thumbnail_brief) values
 ('00000000-0000-8000-8000-000000000081','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Imported first','{"Full imported script"}','{"https://example.com/reference"}','00000000-0000-0000-0000-000000000012','draft','{"Alternative title"}','Imported thumbnail'),
 ('00000000-0000-8000-8000-000000000082','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','Imported second','{"Second script"}','{}','00000000-0000-0000-0000-000000000012','draft','{}','')
on conflict(id) do nothing returning id;
select pg_temp.assert((select count(*)=2 from public.ideas where id in ('00000000-0000-8000-8000-000000000081','00000000-0000-8000-8000-000000000082') and status='draft'),'batch creates two drafts');
update public.ideas set title='Reviewed manually' where id='00000000-0000-8000-8000-000000000081';
insert into public.ideas(id,workspace_id,brand_id,title,author_id) values
 ('00000000-0000-8000-8000-000000000081','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Do not overwrite','00000000-0000-0000-0000-000000000012')
on conflict(id) do nothing returning id;
select pg_temp.assert((select title='Reviewed manually' from public.ideas where id='00000000-0000-8000-8000-000000000081'),'retry preserves manual edit');

do $$ begin
  begin
    insert into public.ideas(id,workspace_id,brand_id,title,author_id) values
      ('00000000-0000-8000-8000-000000000083','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Valid item','00000000-0000-0000-0000-000000000012'),
      ('00000000-0000-8000-8000-000000000084','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000033','Foreign client','00000000-0000-0000-0000-000000000012')
    on conflict(id) do nothing;
    raise exception 'FAIL: cross-workspace batch accepted';
  exception when check_violation or insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert((select count(*)=0 from public.ideas where id in ('00000000-0000-8000-8000-000000000083','00000000-0000-8000-8000-000000000084')),'invalid batch leaves no partial import');

update public.ideas set status='in_review' where id='00000000-0000-8000-8000-000000000081';
select public.approve_idea_project('00000000-0000-8000-8000-000000000081');
select pg_temp.assert((select p.idea_package->'body'->>0='Full imported script'
  and p.idea_package->'references'->>0='https://example.com/reference'
  and p.idea_package->'titleOptions'->>0='Alternative title'
  and p.idea_package->>'thumbnailBrief'='Imported thumbnail'
  and p.channel_id='00000000-0000-0000-0000-000000000021'
  from public.projects p join public.ideas i on i.project_id=p.id where i.id='00000000-0000-8000-8000-000000000081'),'approved import carries client, script, references and planning to project');

reset role;
update public.role_permissions set allowed=false where role='manager' and resource='ideas' and action='create';
set role authenticated;
do $$ begin
  begin
    insert into public.ideas(workspace_id,brand_id,title,author_id) values
      ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Denied manager','00000000-0000-0000-0000-000000000012');
    raise exception 'FAIL: revoked create permission accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000013';
do $$ begin
  begin
    insert into public.ideas(workspace_id,brand_id,title,author_id) values
      ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','Denied editor','00000000-0000-0000-0000-000000000013');
    raise exception 'FAIL: editor import accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: batch insert, retry, manual edit preservation, atomic rollback, tenant isolation, manager revocation, editor denial and project handoff' as result;
