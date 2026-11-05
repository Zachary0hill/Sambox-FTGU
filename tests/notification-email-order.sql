-- Production-safe rollback test; no fixture mail can be seen by the dispatcher.
begin;
create temporary table email_order_fixture as select gen_random_uuid() uid, gen_random_uuid() ws;
insert into auth.users(id,email) select uid,uid||'@ordering.invalid' from email_order_fixture;
insert into public.profiles(id,email) select uid,uid||'@ordering.invalid' from email_order_fixture on conflict do nothing;
insert into public.workspaces(id,name,slug) select ws,'Ordering rollback',ws::text from email_order_fixture;
insert into public.email_outbox(workspace_id,user_id,event,kind,created_at)
select ws,uid,'assigned',label,now() from email_order_fixture cross join (values ('first'),('second'),('third')) x(label);
do $$ declare ws uuid; claimed text[]; n int; begin
 select f.ws into ws from email_order_fixture f;
 select array_agg(kind) into claimed from public.claim_email_outbox(ws,2);
 if claimed <> array['first','second'] then raise exception 'Wrong claim order: %',claimed; end if;
 select count(*) into n from public.claim_email_outbox(ws,2);
 if n<>0 then raise exception 'Overlapping claim overtook in-flight recipient'; end if;
 update public.email_outbox set status='sent' where workspace_id=ws and kind='first';
 select count(*) into n from public.claim_email_outbox(ws,2);
 if n<>0 then raise exception 'Partially completed batch allowed overtaking'; end if;
 update public.email_outbox set claimed_at=now()-interval '11 minutes' where workspace_id=ws and kind='second';
 select array_agg(kind) into claimed from public.claim_email_outbox(ws,2);
 if claimed <> array['second','third'] then raise exception 'Stale recovery order failed: %',claimed; end if;
end $$;
rollback;
select 'PASS: enqueue tie order, batch boundary, overlap exclusion, stale recovery; rolled back' result;
