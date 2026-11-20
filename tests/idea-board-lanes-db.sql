\set ON_ERROR_STOP on
-- Ideas board side lanes and Parked (supabase/migrations/20261119000100_idea_board_lanes.sql). Run in a disposable
-- database built by tests/completion-bootstrap.py, as the superuser:
--   python3 tests/completion-bootstrap.py > /tmp/boot.sql && createdb t && psql -d t -f /tmp/boot.sql && psql -d t -f tests/idea-board-lanes-db.sql
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$ begin execute q; return ''; exception when others then return sqlstate; end $$;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\set ws '''20000000-0000-0000-0000-000000000001'''
\set admin '''10000000-0000-0000-0000-000000000001'''
\set editor '''10000000-0000-0000-0000-000000000002'''
\set manager '''10000000-0000-0000-0000-000000000003'''
\set idea '''00000000-0000-8000-8000-0000000000e1'''
insert into public.brand_kits (id, workspace_id, name, kind) values ('00000000-0000-8000-8000-0000000000e9', :ws, 'Lanes brand', 'channel');
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms)
values (:idea, :ws, '00000000-0000-8000-8000-0000000000e9', 'Lane idea', :admin, '{"Some notes"}', '{}');

-- Every workspace has one On Hold lane, existing and new
select pg_temp.assert((select count(*) = 1 and min(label) = 'On Hold' and min(color) = 'blue' and min(position) = 0 from public.idea_board_columns where workspace_id = :ws and kind = 'hold'), 'existing workspace got its On Hold lane');
insert into public.workspaces (id, name, slug) values ('20000000-0000-0000-0000-0000000000f1', 'Lanes other', 'lanes-other');
select pg_temp.assert((select count(*) = 1 from public.idea_board_columns where workspace_id = '20000000-0000-0000-0000-0000000000f1' and kind = 'hold'), 'new workspace gets an On Hold lane');
select pg_temp.assert(pg_temp.err($q$insert into public.idea_board_columns (workspace_id, kind, label) values ('20000000-0000-0000-0000-000000000001', 'hold', 'Second hold')$q$) = '23505', 'only one On Hold lane per workspace');
select pg_temp.assert(pg_temp.err($q$insert into public.idea_board_columns (workspace_id, label, color) values ('20000000-0000-0000-0000-000000000001', 'Teal', 'teal')$q$) = '23514', 'color must be an option token');
select pg_temp.assert(pg_temp.err($q$insert into public.idea_board_columns (workspace_id, label) values ('20000000-0000-0000-0000-000000000001', '   ')$q$) = '23514', 'a lane needs a name');

-- Who manages lanes: Super Admin yes, editor no, manager only with ideas:edit
grant select, insert, update, delete on public.idea_board_columns to authenticated;
set role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
insert into public.idea_board_columns (workspace_id, label, color) values (:ws, '  Shoot list ', 'violet');
insert into public.idea_board_columns (workspace_id, label) values (:ws, 'Maybe');
select pg_temp.assert((select position = 1 and label = 'Shoot list' and created_by = :admin from public.idea_board_columns where workspace_id = :ws and label = 'Shoot list'), 'new lane goes to the right end, trimmed, with its author');
select pg_temp.assert((select position = 2 from public.idea_board_columns where workspace_id = :ws and label = 'Maybe'), 'next lane after it');
select pg_temp.assert(pg_temp.err($q$update public.idea_board_columns set kind = 'hold' where label = 'Maybe'$q$) = '42501', 'kind never changes');
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) = 3 from public.idea_board_columns where workspace_id = :ws), 'editors read the lanes');
select pg_temp.assert(pg_temp.err($q$insert into public.idea_board_columns (workspace_id, label) values ('20000000-0000-0000-0000-000000000001', 'Editor lane')$q$) = '42501', 'editors cannot add lanes');
update public.idea_board_columns set label = 'Renamed by editor' where label = 'Maybe';
select pg_temp.assert(not exists (select 1 from public.idea_board_columns where label = 'Renamed by editor'), 'editors cannot rename lanes');
reset role;
insert into public.role_permissions (workspace_id, role, resource, action, allowed) values (:ws, 'manager', 'ideas', 'edit', false)
  on conflict (workspace_id, role, resource, action) do update set allowed = false;
set role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000003');
update public.idea_board_columns set label = 'Manager rename' where label = 'Maybe';
select pg_temp.assert(not exists (select 1 from public.idea_board_columns where label = 'Manager rename'), 'a manager without ideas:edit cannot rename');
reset role;
update public.role_permissions set allowed = true where workspace_id = :ws and role = 'manager' and resource = 'ideas' and action = 'edit';
set role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000003');
update public.idea_board_columns set label = 'Maybe later', color = 'amber' where label = 'Maybe';
select pg_temp.assert(exists (select 1 from public.idea_board_columns where label = 'Maybe later' and color = 'amber'), 'a manager with ideas:edit renames and recolours');
reset role;

-- Placing an idea: one place at a time, stamped with who and when
create function pg_temp.lane(l text) returns uuid language sql as $$ select id from public.idea_board_columns where workspace_id = '20000000-0000-0000-0000-000000000001' and label = l $$;
create function pg_temp.at() returns text language sql as $$
  select coalesce((select label from public.idea_board_columns c where c.id = i.board_column_id), '-') || '/' || stage::text || '/' || (parked_at is not null)::text
  from public.ideas i where id = '00000000-0000-8000-8000-0000000000e1' $$;
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
update public.ideas set board_column_id = pg_temp.lane('On Hold') where id = :idea;
select pg_temp.assert(pg_temp.at() = 'On Hold/inbox/false', 'placed on hold, stage kept');
select pg_temp.assert((select board_column_at is not null and board_column_by = :admin from public.ideas where id = :idea), 'hold records who and when');
update public.ideas set title = 'Lane idea, renamed' where id = :idea;
select pg_temp.assert(pg_temp.at() = 'On Hold/inbox/false', 'an unrelated edit keeps the lane');
update public.ideas set parked_at = now() where id = :idea;
select pg_temp.assert(pg_temp.at() = '-/inbox/true', 'parking takes it out of its side lane');
select pg_temp.assert((select parked_by = :admin and board_column_at is null and board_column_by is null from public.ideas where id = :idea), 'parking records who, lane stamps cleared');
update public.ideas set board_column_id = pg_temp.lane('Shoot list') where id = :idea;
select pg_temp.assert(pg_temp.at() = 'Shoot list/inbox/false', 'placing in a lane unparks');
select pg_temp.assert((select parked_by is null from public.ideas where id = :idea), 'unparking clears who parked it');
update public.ideas set stage = 'research' where id = :idea;
select pg_temp.assert(pg_temp.at() = '-/research/false', 'a stage move returns it to the stage lane');
update public.ideas set stage = 'ready', board_column_id = pg_temp.lane('Maybe later') where id = :idea;
select pg_temp.assert(pg_temp.at() = 'Maybe later/ready/false', 'a stage move that also picks a lane keeps that lane');
select pg_temp.assert(pg_temp.err($q$update public.ideas set board_column_id = (select id from public.idea_board_columns where workspace_id = '20000000-0000-0000-0000-0000000000f1') where id = '00000000-0000-8000-8000-0000000000e1'$q$) = '23503', 'a lane from another workspace is refused');
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms, board_column_id)
values ('00000000-0000-8000-8000-0000000000e2', :ws, '00000000-0000-8000-8000-0000000000e9', 'No notes yet', :admin, '{}', '{}', pg_temp.lane('On Hold'));
select pg_temp.assert(pg_temp.err($q$update public.ideas set stage = 'ready' where id = '00000000-0000-8000-8000-0000000000e2'$q$) = '23514', 'gates still decide stage moves out of a side lane');
select pg_temp.assert((select board_column_id = pg_temp.lane('On Hold') and board_column_by = :admin from public.ideas where id = '00000000-0000-8000-8000-0000000000e2'), 'a refused move leaves it on hold; an idea can be captured straight into a lane');

-- Deleting a lane moves its ideas one lane left; with none left they go back to their stage lane
update public.ideas set stage = 'ready', board_column_id = pg_temp.lane('Maybe later') where id = :idea;
delete from public.idea_board_columns where id = pg_temp.lane('Maybe later');
select pg_temp.assert(pg_temp.at() = 'Shoot list/ready/false', 'deleting a lane moves its ideas left');
delete from public.idea_board_columns where id = pg_temp.lane('Shoot list');
select pg_temp.assert(pg_temp.at() = 'On Hold/ready/false', 'the first custom lane hands its ideas to On Hold');
delete from public.idea_board_columns where id = pg_temp.lane('On Hold');
select pg_temp.assert(pg_temp.at() = '-/ready/false', 'deleting On Hold returns ideas to their stage lane');
select pg_temp.assert((select board_column_at is null from public.ideas where id = :idea), 'and clears the lane stamp');
insert into public.idea_board_columns (workspace_id, kind, label, color) values (:ws, 'hold', 'On Hold', 'blue');
select pg_temp.assert((select count(*) = 1 from public.idea_board_columns where workspace_id = :ws and kind = 'hold'), 'On Hold can be added back');

\echo idea-board-lanes-db: all assertions passed
