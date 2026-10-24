-- Select and Multi select options (database components handoff, step 3).
--
-- custom_fields.config (data model change 2): per-type column settings. Step 3 uses option_sort; the Edit property
-- sheet (step 5) adds the rest. Shape:
--   { "option_sort": "manual" | "alpha" | "alpha_desc", "number_format", "decimals", "date_format", "end_date",
--     "include_time", "due_colors", "reminder", "person_limit", "show_as": "pill" | "block", "required",
--     "show_on_cards", "default_value" }
--
-- Values keep option labels (a string for Select, an array of strings for Multi select), the same as
-- change_field_type writes. So renaming, deleting or merging an option rewrites the values that use it; these
-- functions do that and the options change in one transaction. Creating, recoloring and reordering options only
-- touch custom_fields.options, which Super Admins update directly under the existing custom_fields policies.

alter table public.custom_fields
  add column if not exists config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object');

comment on column public.custom_fields.config is
  'Per-type column settings: option_sort (manual | alpha | alpha_desc), number_format, decimals, date_format, end_date, include_time, due_colors, reminder, person_limit, show_as (pill | block), required, show_on_cards, default_value.';

-- Loads a Select or Multi select field for an option change and checks the caller is a Super Admin.
create or replace function app.option_field(p_field uuid)
returns public.custom_fields
language plpgsql stable security invoker set search_path = '' as $$
declare
  f public.custom_fields;
begin
  select * into f from public.custom_fields where id = p_field;
  if not found then raise exception 'That column no longer exists.'; end if;
  if not app.is_admin(f.workspace_id) then raise exception 'Only Super Admins can change options.'; end if;
  if f.type not in ('select', 'multi_select') then raise exception 'Only Select and Multi select columns have options.'; end if;
  return f;
end $$;

-- The label of an option by id, or an error if it is gone.
create or replace function app.option_label(f public.custom_fields, p_option text)
returns text
language sql immutable set search_path = '' as $$
  select o ->> 'label' from jsonb_array_elements(case when jsonb_typeof(f.options) = 'array' then f.options else '[]'::jsonb end) o
  where o ->> 'id' = p_option limit 1
$$;

create or replace function public.rename_field_option(p_field uuid, p_option text, p_label text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields := app.option_field(p_field);
  old text := app.option_label(f, p_option);
  lbl text := btrim(coalesce(p_label, ''));
begin
  if old is null then raise exception 'That option no longer exists.'; end if;
  if lbl = '' then raise exception 'Options need a name.'; end if;
  if lbl = old then return; end if;
  if exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'id' <> p_option and lower(o ->> 'label') = lower(lbl)) then
    raise exception 'There is already an option named %.', lbl;
  end if;
  update public.custom_fields set options = (
    select jsonb_agg(case when o ->> 'id' = p_option then jsonb_set(o, '{label}', to_jsonb(lbl)) else o end order by ord)
    from jsonb_array_elements(f.options) with ordinality as x(o, ord)
  ) where id = p_field;
  if f.type = 'select' then
    update public.project_field_values set value = to_jsonb(lbl) where field_id = p_field and value #>> '{}' = old;
  else
    update public.project_field_values v set value = (
      select jsonb_agg(case when e #>> '{}' = old then to_jsonb(lbl) else e end order by ord)
      from jsonb_array_elements(v.value) with ordinality as x(e, ord)
    ) where v.field_id = p_field and jsonb_typeof(v.value) = 'array' and v.value ? old;
  end if;
end $$;

-- Removes the option and clears it from every value. Returns how many projects had it.
create or replace function public.delete_field_option(p_field uuid, p_option text)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields := app.option_field(p_field);
  old text := app.option_label(f, p_option);
  n int;
begin
  if old is null then return 0; end if;
  update public.custom_fields set options = coalesce((
    select jsonb_agg(o order by ord) from jsonb_array_elements(f.options) with ordinality as x(o, ord) where o ->> 'id' <> p_option
  ), '[]'::jsonb) where id = p_field;
  if f.type = 'select' then
    delete from public.project_field_values where field_id = p_field and value #>> '{}' = old;
    get diagnostics n = row_count;
  else
    update public.project_field_values v set value = coalesce((
      select jsonb_agg(e order by ord) from jsonb_array_elements(v.value) with ordinality as x(e, ord) where e #>> '{}' <> old
    ), '[]'::jsonb) where v.field_id = p_field and jsonb_typeof(v.value) = 'array' and v.value ? old;
    get diagnostics n = row_count;
    delete from public.project_field_values where field_id = p_field and jsonb_typeof(value) = 'array' and jsonb_array_length(value) = 0;
  end if;
  return n;
end $$;

-- Moves every use of one option to another, then removes the first. Multi select values drop the duplicate.
create or replace function public.merge_field_option(p_field uuid, p_option text, p_into text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields := app.option_field(p_field);
  old text := app.option_label(f, p_option);
  tgt text := app.option_label(f, p_into);
begin
  if old is null or tgt is null then raise exception 'That option no longer exists.'; end if;
  if p_option = p_into then return; end if;
  if f.type = 'select' then
    update public.project_field_values set value = to_jsonb(tgt) where field_id = p_field and value #>> '{}' = old;
  else
    update public.project_field_values v set value = (
      select jsonb_agg(l order by first_ord) from (
        select case when e #>> '{}' = old then to_jsonb(tgt) else e end as l, min(ord) as first_ord
        from jsonb_array_elements(v.value) with ordinality as x(e, ord)
        group by 1
      ) d
    ) where v.field_id = p_field and jsonb_typeof(v.value) = 'array' and v.value ? old;
  end if;
  update public.custom_fields set options = coalesce((
    select jsonb_agg(o order by ord) from jsonb_array_elements(f.options) with ordinality as x(o, ord) where o ->> 'id' <> p_option
  ), '[]'::jsonb) where id = p_field;
end $$;

revoke execute on function app.option_field(uuid), app.option_label(public.custom_fields, text),
  public.rename_field_option(uuid, text, text), public.delete_field_option(uuid, text),
  public.merge_field_option(uuid, text, text) from public, anon;
grant execute on function app.option_field(uuid), app.option_label(public.custom_fields, text),
  public.rename_field_option(uuid, text, text), public.delete_field_option(uuid, text),
  public.merge_field_option(uuid, text, text) to authenticated;
