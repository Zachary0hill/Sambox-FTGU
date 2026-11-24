\set ON_ERROR_STOP on
begin;
\set ws '20000000-0000-0000-0000-000000000001'
\set admin '10000000-0000-0000-0000-000000000001'
\set editor '10000000-0000-0000-0000-000000000002'
\set manager '10000000-0000-0000-0000-000000000003'
\set project '30000000-0000-0000-0000-000000000001'
create function pg_temp.ok(p boolean, msg text) returns void language plpgsql as $$begin if p is not true then raise exception 'Failed: %',msg; end if;end$$;
create function pg_temp.fails(q text) returns boolean language plpgsql as $$begin execute q; return false; exception when others then return true; end$$;
insert into public.dev_notes(workspace_id, content, created_by, is_resolved) values (:'ws','A resolved source note needs explicit acceptance',:'editor',true) returning id as note \gset
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","aal":"aal1"}';
select set_config('request.jwt.claim.sub',:'admin',true);
select pg_temp.ok(count(*)=0,'existing resolution never auto-accepts') from public.dev_note_decision_events where note_id=:'note';
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,0,gen_random_uuid(),%L,%L,%L,%L)',:'note','assign','','duplicates',:'manager')), 'an unrelated internal user cannot be assigned');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,0,gen_random_uuid(),%L,%L,%L,%L,gen_random_uuid())',:'note','assign','','duplicates',:'editor')),'missing project rejected');
select gen_random_uuid() as request \gset
select pg_temp.ok((record_dev_note_decision(:'note',0,:'request','assign','','duplicates',:'editor',:'project')).revision=1,'assign');
select pg_temp.ok((record_dev_note_decision(:'note',0,:'request','assign','','duplicates',:'editor',:'project')).revision=1,'identical retry');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,1,gen_random_uuid(),%L,%L)',:'note','answer','admin answer')),'only reviewer may answer');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,1,gen_random_uuid(),%L)',:'note','ready')),'ready needs answer');
select set_config('request.jwt.claim.sub',:'manager',true);
select pg_temp.ok(count(*)=0,'different manager cannot read') from public.dev_note_decision_events where note_id=:'note';
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,1,gen_random_uuid(),%L,%L)',:'note','answer','guess')),'cannot write hidden decision');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.ok((record_dev_note_decision(:'note',1,gen_random_uuid(),'answer','Copy the script.')).actor_id=:'editor','assigned author can answer even after legacy resolution');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,1,gen_random_uuid(),%L,%L)',:'note','answer','old state')),'stale response rejected');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,2,gen_random_uuid(),%L)',:'note','ready')),'reviewer cannot declare implementation ready');
select set_config('request.jwt.claim.sub',:'admin',true);
select pg_temp.ok((record_dev_note_decision(:'note',2,gen_random_uuid(),'ready')).state='ready_to_try','ready and acceptance distinct');
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,3,gen_random_uuid(),%L,%L)',:'note','accept','admin signoff')),'delivery owner cannot accept for reviewer');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.ok(pg_temp.fails(format('select record_dev_note_decision(%L,3,gen_random_uuid(),%L,%L)',:'note','accept',' ')),'acceptance requires comment');
select pg_temp.ok((record_dev_note_decision(:'note',3,gen_random_uuid(),'accept','Verified the copy has a new ID.')).state='accepted','reviewer accepts with example');
select pg_temp.ok((record_dev_note_decision(:'note',4,gen_random_uuid(),'reopen','Please include references.')).state='needs_decision','reopen retains previous sign-off');
select pg_temp.ok(count(*)=5 and count(distinct request_id)=5 and bool_and(created_at is not null and actor_name<>''),'full attributable history') from public.dev_note_decision_events where note_id=:'note';
select pg_temp.ok(not has_table_privilege(current_user,'public.dev_note_decision_events','UPDATE') and not has_table_privilege(current_user,'public.dev_note_decision_events','INSERT'),'no direct mutation');
select pg_temp.ok((select is_resolved and content='A resolved source note needs explicit acceptance' from dev_notes where id=:'note'),'old note preserved');
rollback;
