-- One Rules row per workspace. A missing row reads as the defaults in lib/ideas/rules-shared.ts.
create table public.ideas_rules (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ideas_rules enable row level security;
create policy ideas_rules_select on public.ideas_rules for select to authenticated
  using ((select app.is_member(workspace_id)));
create policy ideas_rules_insert on public.ideas_rules for insert to authenticated
  with check ((select app.is_admin(workspace_id)));
create policy ideas_rules_update on public.ideas_rules for update to authenticated
  using ((select app.is_admin(workspace_id))) with check ((select app.is_admin(workspace_id)));
create trigger set_updated_at before update on public.ideas_rules
  for each row execute function extensions.moddatetime(updated_at);
alter publication supabase_realtime add table public.ideas_rules;

-- Types and formats now come from Rules, so they can no longer be fixed lists in the database.
-- `type` stays in sync through the trigger below so a client that has not reloaded keeps working.
alter table public.ideas add column idea_type text not null default 'Idea'
  check (length(trim(idea_type)) between 1 and 60);

alter table public.ideas drop constraint if exists ideas_format_check;
alter table public.ideas add constraint ideas_format_check check (format is null or length(trim(format)) between 1 and 60);

alter table public.ideas disable trigger set_updated_at;
update public.ideas set idea_type = initcap(type::text) where type <> 'idea';
alter table public.ideas enable trigger set_updated_at;

create or replace function app.sync_idea_type() returns trigger
language plpgsql set search_path = '' as $$
declare type_led boolean;
begin
  if tg_op = 'INSERT' then
    type_led := new.idea_type = 'Idea' and new.type <> 'idea';
  else
    if new.idea_type is not distinct from old.idea_type and new.type is not distinct from old.type then
      return new;
    end if;
    type_led := new.idea_type is not distinct from old.idea_type;
  end if;

  if type_led then
    new.idea_type := initcap(new.type::text);
  else
    new.type := (case lower(trim(new.idea_type))
      when 'script' then 'script'
      when 'research' then 'research'
      else 'idea'
    end)::public.idea_type;
  end if;
  return new;
end $$;

create trigger a1_sync_idea_type before insert or update on public.ideas
  for each row execute function app.sync_idea_type();
