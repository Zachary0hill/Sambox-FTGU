-- Ideas board lanes (handoff/ideas-research-handoff-2026-11-19, Phase 4). Tested by tests/idea-board-lanes-db.sql.
--
-- The Ideas board gets lanes beside the four workflow stages, plus a Parked list off the board:
--   * Side lanes (public.idea_board_columns): the On Hold lane, seeded once per workspace, and the columns a team
--     adds. An idea in a side lane keeps its stage and its gates; ideas.board_column_id says which side lane it sits in.
--     Moving the idea to a stage lane clears it. (Open questions 2 and 4. On Hold is a seeded side lane rather than an
--     on_hold_at flag, so it can be renamed, recoloured and deleted the same way as a custom column, as the design asks.)
--   * Parked (ideas.parked_at): "maybe later" ideas leave the board and show in the Parked saved view. They keep their
--     stage, and archiving stays a separate, stronger action. (Open question 3.)
-- Who manages side lanes: Super Admins, and managers with ideas:edit (app.can_manage). Anyone who can edit an idea can
-- move it between lanes, through the ideas policies that already exist.

-- ---------- Side lanes ----------
create table public.idea_board_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null default 'custom' check (kind in ('hold','custom')),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  -- The eight option color tokens (OPTION_COLORS in lib/studio/tones.js), so SwatchList can pick them.
  color text not null default 'gray' check (color in ('gray','coral','pink','violet','blue','green','amber','red')),
  -- Order among the side lanes, left to right after the four stages. Filled in on insert when left out.
  position int not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index idea_board_columns_one_hold on public.idea_board_columns (workspace_id) where kind = 'hold';
create index idea_board_columns_order on public.idea_board_columns (workspace_id, position);

alter table public.idea_board_columns enable row level security;
create policy ibc_select on public.idea_board_columns for select to authenticated
  using ((select app.is_member(workspace_id)));
create policy ibc_insert on public.idea_board_columns for insert to authenticated
  with check ((select app.can_manage(workspace_id, 'ideas', 'edit')));
create policy ibc_update on public.idea_board_columns for update to authenticated
  using ((select app.can_manage(workspace_id, 'ideas', 'edit')))
  with check ((select app.can_manage(workspace_id, 'ideas', 'edit')));
create policy ibc_delete on public.idea_board_columns for delete to authenticated
  using ((select app.can_manage(workspace_id, 'ideas', 'edit')));

create trigger set_updated_at before update on public.idea_board_columns
  for each row execute function extensions.moddatetime(updated_at);

-- New lanes go to the right end unless a position is given; a lane never changes workspace or kind.
create or replace function app.idea_board_column_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.label := btrim(new.label);
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.position is null then
      select coalesce(max(position) + 1, 0) into new.position
        from public.idea_board_columns where workspace_id = new.workspace_id;
    end if;
    return new;
  end if;
  if new.workspace_id is distinct from old.workspace_id or new.kind is distinct from old.kind then
    raise exception 'A board lane keeps its workspace and kind' using errcode = '42501';
  end if;
  new.label := btrim(new.label);
  return new;
end $$;
create trigger a0_idea_board_column_defaults before insert or update on public.idea_board_columns
  for each row execute function app.idea_board_column_defaults();

-- Deleting a lane moves its ideas to the side lane on its left. With none there (On Hold, or the first column after a
-- deleted On Hold), they go back to their own stage lanes; nothing jumps into Approved, which would skip approval.
create or replace function app.idea_board_column_release() returns trigger
language plpgsql security definer set search_path = '' as $$
declare left_id uuid;
begin
  select c.id into left_id from public.idea_board_columns c
    where c.workspace_id = old.workspace_id and c.id <> old.id
      and (c.position < old.position or (c.position = old.position and c.created_at < old.created_at))
    order by c.position desc, c.created_at desc limit 1;
  update public.ideas set board_column_id = left_id
    where workspace_id = old.workspace_id and board_column_id = old.id;
  return old;
end $$;
create trigger idea_board_column_release before delete on public.idea_board_columns
  for each row execute function app.idea_board_column_release();
revoke all on function app.idea_board_column_release() from public, anon, authenticated;

-- One On Hold lane in every workspace, now and for new ones. Sky in the design; blue is the closest token.
insert into public.idea_board_columns (workspace_id, kind, label, color, position)
  select id, 'hold', 'On Hold', 'blue', 0 from public.workspaces
  on conflict do nothing;
create or replace function app.seed_idea_board_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.idea_board_columns (workspace_id, kind, label, color, position)
    values (new.id, 'hold', 'On Hold', 'blue', 0)
    on conflict do nothing;
  return new;
end $$;
create trigger seed_idea_board_columns after insert on public.workspaces
  for each row execute function app.seed_idea_board_columns();
revoke all on function app.seed_idea_board_columns() from public, anon, authenticated;

-- ---------- Ideas: side lane and Parked ----------
alter table public.ideas
  add column board_column_id uuid,
  add column board_column_at timestamptz,
  add column board_column_by uuid references public.profiles(id) on delete set null,
  add column parked_at timestamptz,
  add column parked_by uuid references public.profiles(id) on delete set null,
  -- The lane must belong to the idea's workspace. A deleted lane clears only this column (the release trigger above
  -- normally moves the ideas first).
  add constraint ideas_board_column_fk foreign key (workspace_id, board_column_id)
    references public.idea_board_columns (workspace_id, id) on delete set null (board_column_id);
create index ideas_board_column_idx on public.ideas (board_column_id) where board_column_id is not null;
create index ideas_parked_idx on public.ideas (workspace_id, parked_at) where parked_at is not null;

-- An idea sits in exactly one place: a stage lane, a side lane, or Parked. Whatever the write just set wins:
--   * placing it in a side lane unparks it; parking it takes it out of its side lane;
--   * a stage move returns it to that stage's lane, unless the same write also placed it in a side lane.
-- Each placement records who made it and when. Gates still run on stage moves (a2_gate_idea_stage).
create or replace function app.idea_board_place() returns trigger
language plpgsql set search_path = '' as $$
declare
  lane_set boolean := new.board_column_id is not null and (tg_op = 'INSERT' or new.board_column_id is distinct from old.board_column_id);
  park_set boolean := new.parked_at is not null and (tg_op = 'INSERT' or old.parked_at is null);
begin
  if park_set then
    new.board_column_id := null;
  elsif lane_set then
    new.parked_at := null;
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.board_column_id := null;
  end if;

  if new.board_column_id is null then
    new.board_column_at := null;
    new.board_column_by := null;
  elsif tg_op = 'INSERT' or new.board_column_id is distinct from old.board_column_id then
    new.board_column_at := now();
    new.board_column_by := auth.uid();
  else
    new.board_column_at := old.board_column_at;
    new.board_column_by := old.board_column_by;
  end if;

  if new.parked_at is null then
    new.parked_by := null;
  elsif tg_op = 'INSERT' or old.parked_at is null then
    new.parked_by := auth.uid();
  else
    new.parked_at := old.parked_at;
    new.parked_by := old.parked_by;
  end if;
  return new;
end $$;
-- Named to run after the stage sync (a0) and the type sync (a1); the gate (a2) only reads stage and archived_at.
create trigger a3_idea_board_place before insert or update on public.ideas
  for each row execute function app.idea_board_place();

-- ---------- Realtime ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'idea_board_columns') then
    alter publication supabase_realtime add table public.idea_board_columns;
  end if;
end $$;
