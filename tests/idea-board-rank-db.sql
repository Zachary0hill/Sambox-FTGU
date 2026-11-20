\set ON_ERROR_STOP on
-- Ideas board manual order (supabase/migrations/20261120000200_idea_board_rank.sql). Run in a disposable database built
-- by tests/completion-bootstrap.py, as the superuser:
--   python3 tests/completion-bootstrap.py > /tmp/boot.sql && createdb t && psql -d t -f /tmp/boot.sql && psql -d t -f tests/idea-board-rank-db.sql
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'FAIL: %',msg; end if; end $$;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\set ws '''20000000-0000-0000-0000-000000000001'''
\set admin '''10000000-0000-0000-0000-000000000001'''
\set brand '''00000000-0000-8000-8000-0000000000d9'''
insert into public.brand_kits (id, workspace_id, name, kind) values (:brand, :ws, 'Rank brand', 'channel');

-- Every existing idea has a rank, and no two in a workspace share one
select pg_temp.assert(not exists (select 1 from public.ideas where board_rank is null), 'existing ideas were ranked');
select pg_temp.assert((select count(*) = count(distinct board_rank) from public.ideas where workspace_id = :ws), 'backfilled ranks are distinct');

-- A new idea goes to the top; several captured in one statement each get their own place
select coalesce(min(board_rank), 1) as top from public.ideas where workspace_id = :ws \gset
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms)
values ('00000000-0000-8000-8000-0000000000d1', :ws, :brand, 'Rank one', :admin, '{}', '{}');
select pg_temp.assert((select board_rank = :top - 1 from public.ideas where id = '00000000-0000-8000-8000-0000000000d1'), 'a new idea goes above every other');
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms) values
  ('00000000-0000-8000-8000-0000000000d2', :ws, :brand, 'Rank two', :admin, '{}', '{}'),
  ('00000000-0000-8000-8000-0000000000d3', :ws, :brand, 'Rank three', :admin, '{}', '{}');
select pg_temp.assert((select count(distinct board_rank) = 3 and max(board_rank) = :top - 1 from public.ideas where id in ('00000000-0000-8000-8000-0000000000d1', '00000000-0000-8000-8000-0000000000d2', '00000000-0000-8000-8000-0000000000d3')), 'ideas captured together each get their own place, above the last');
insert into public.ideas (id, workspace_id, brand_id, title, author_id, body, platforms, board_rank)
values ('00000000-0000-8000-8000-0000000000d4', :ws, :brand, 'Rank given', :admin, '{}', '{}', 42.5);
select pg_temp.assert((select board_rank = 42.5 from public.ideas where id = '00000000-0000-8000-8000-0000000000d4'), 'a rank given on insert is kept');

-- Reordering is not an edit: updated_at stays. Any other change still stamps it.
alter table public.ideas disable trigger set_updated_at;
update public.ideas set updated_at = '2026-01-01T00:00:00Z' where id = '00000000-0000-8000-8000-0000000000d1';
alter table public.ideas enable trigger set_updated_at;
grant select, insert, update, delete on public.ideas to authenticated;
set role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
update public.ideas set board_rank = 7.25 where id = '00000000-0000-8000-8000-0000000000d1';
select pg_temp.assert((select board_rank = 7.25 and updated_at = '2026-01-01T00:00:00Z' from public.ideas where id = '00000000-0000-8000-8000-0000000000d1'), 'a rank-only write keeps updated_at');
update public.ideas set board_rank = null where id = '00000000-0000-8000-8000-0000000000d1';
select pg_temp.assert((select board_rank = 7.25 from public.ideas where id = '00000000-0000-8000-8000-0000000000d1'), 'a rank cannot be cleared');
update public.ideas set board_rank = 8, title = 'Rank one, renamed' where id = '00000000-0000-8000-8000-0000000000d1';
select pg_temp.assert((select board_rank = 8 and updated_at > '2026-06-01T00:00:00Z' from public.ideas where id = '00000000-0000-8000-8000-0000000000d1'), 'a rank written with another change stamps updated_at');
reset role;

-- An editor cannot reorder: the update policies still decide who writes a card
set role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
update public.ideas set board_rank = 99 where id = '00000000-0000-8000-8000-0000000000d1';
reset role;
select pg_temp.assert((select board_rank = 8 from public.ideas where id = '00000000-0000-8000-8000-0000000000d1'), 'someone who cannot edit the idea cannot reorder it');

\echo idea-board-rank-db: all assertions passed
