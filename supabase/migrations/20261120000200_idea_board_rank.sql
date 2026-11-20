-- Ideas board: manual card order.
--
-- ideas.board_rank is where a card sits when the board is sorted by Manual: lowest first, in every lane. Dragging a
-- card up or down its lane writes one number between its two neighbours, so a reorder is a single-row update that the
-- existing update policies already cover (you can reorder the cards you can edit).
--   * Existing ideas start in the board's Score order (best score first, unscored after, most recently updated
--     first within each), so the first switch from Score to Manual leaves every card where it was.
--   * A new idea goes to the top of the manual order.
--   * A write that changes nothing but the rank is not an edit: it leaves updated_at alone, so reordering never
--     resets "Stale 14d+" or the stale-idea automations.

alter table public.ideas add column board_rank double precision;

-- The score the board shows: the research total, else the ICE average out of 100 (scoreOf in lib/studio/vals-ideas.js).
alter table public.ideas disable trigger set_updated_at;
update public.ideas i set board_rank = r.n
  from (select id, row_number() over (partition by workspace_id order by (score is null), score desc, updated_at desc, id) as n
    from (select id, workspace_id, updated_at,
        case when jsonb_typeof(research -> 'score') = 'object'
               then case when jsonb_typeof(research #> '{score,total}') = 'number' then (research #>> '{score,total}')::numeric end
             when impact is not null and confidence is not null and ease is not null
               then round(((impact + confidence + ease) / 3.0) * 10) end as score
      from public.ideas) s) r
  where r.id = i.id;
alter table public.ideas enable trigger set_updated_at;

create index ideas_board_rank_idx on public.ideas (workspace_id, board_rank);

-- Security definer so the top of the order is the workspace's, not just the brands the author can see.
create or replace function app.idea_board_rank() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.board_rank is null then
      select coalesce(min(i.board_rank), 1) - 1 into new.board_rank
        from public.ideas i where i.workspace_id = new.workspace_id;
    end if;
  elsif new.board_rank is null then
    new.board_rank := old.board_rank;
  elsif new.board_rank is distinct from old.board_rank
    and (to_jsonb(new) - 'board_rank' - 'updated_at') = (to_jsonb(old) - 'board_rank' - 'updated_at') then
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;
revoke all on function app.idea_board_rank() from public, anon, authenticated;

-- Named to run last, after set_updated_at, so a rank-only write can put updated_at back.
create trigger zz_idea_board_rank before insert or update on public.ideas
  for each row execute function app.idea_board_rank();

alter table public.ideas alter column board_rank set not null;
