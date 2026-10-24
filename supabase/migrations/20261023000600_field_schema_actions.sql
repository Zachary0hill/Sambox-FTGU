-- Column schema actions for the board header menu (database components handoff, step 2):
--   change_field_type  changes a custom field's type and converts its values in the same transaction
--   duplicate_field    copies a field with its values
--   delete_field       deletes a field and returns a snapshot that restore_field takes back for undo
-- Each runs as the caller (security invoker), so the custom_fields and project_field_values policies still apply,
-- and each checks for a Super Admin first.
--
-- Select and Multi select options use the shape from data model change 1. The column already exists as jsonb.

comment on column public.custom_fields.options is
  'Select and Multi select options: [{ "id": text, "label": text, "color_token": text, "sort": int }]. color_token is one of gray, coral, pink, violet, blue, green, amber, red.';

-- A stored value as plain text: arrays join with commas, true reads as Yes.
create or replace function app.field_text(v jsonb)
returns text
language sql immutable set search_path = '' as $$
  select case jsonb_typeof(v)
    when 'array' then (select string_agg(e #>> '{}', ', ') from jsonb_array_elements(v) e)
    when 'boolean' then case when v = 'true'::jsonb then 'Yes' end
    when 'null' then null
    else nullif(btrim(v #>> '{}'), '')
  end
$$;

-- A stored value as option labels. With split, plain text breaks on commas (multi select).
create or replace function app.field_labels(v jsonb, split boolean)
returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(
    select btrim(x) from unnest(case
      when jsonb_typeof(v) = 'array' then array(select e #>> '{}' from jsonb_array_elements(v) e)
      when split then string_to_array(app.field_text(v), ',')
      else array[app.field_text(v)]
    end) x
    where nullif(btrim(x), '') is not null
  ), '{}')
$$;

create or replace function public.change_field_type(p_field uuid, p_type public.field_type)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields;
  opts jsonb;
  palette text[] := array['coral', 'pink', 'violet', 'blue', 'green', 'amber', 'red', 'gray'];
  n int;
  lbl text;
  r record;
  d date;
  t text;
begin
  -- Check the role before locking: FOR UPDATE goes through the update policy and would hide the row instead.
  select * into f from public.custom_fields where id = p_field;
  if not found then raise exception 'That column no longer exists.'; end if;
  if not app.is_admin(f.workspace_id) then raise exception 'Only Super Admins can change a column type.'; end if;
  perform 1 from public.custom_fields where id = p_field for update;
  if f.type = p_type then return; end if;

  opts := case when jsonb_typeof(f.options) = 'array' then f.options else '[]'::jsonb end;

  if p_type in ('select', 'multi_select') then
    -- Each distinct value becomes an option (existing options keep their color), new ones take the next color.
    n := jsonb_array_length(opts);
    for lbl in
      select distinct l from public.project_field_values v, unnest(app.field_labels(v.value, p_type = 'multi_select')) l
      where v.field_id = p_field order by l
    loop
      if not exists (select 1 from jsonb_array_elements(opts) o where lower(o ->> 'label') = lower(lbl)) then
        opts := opts || jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text, 'label', lbl, 'color_token', palette[(n % 8) + 1], 'sort', (n + 1) * 100));
        n := n + 1;
      end if;
    end loop;
  end if;

  if p_type = 'select' then
    update public.project_field_values v set value = to_jsonb((app.field_labels(v.value, false))[1]) where v.field_id = p_field;
  elsif p_type = 'multi_select' then
    update public.project_field_values v set value = to_jsonb(app.field_labels(v.value, true)) where v.field_id = p_field;
    delete from public.project_field_values where field_id = p_field and jsonb_array_length(value) = 0;
  elsif p_type = 'number' then
    -- "$4,500" reads as 4500. Anything else that is not a number is cleared.
    update public.project_field_values v set value = case
      when regexp_replace(coalesce(app.field_text(v.value), ''), '[$,\s]', '', 'g') ~ '^-?\d+(\.\d+)?$'
      then to_jsonb(regexp_replace(app.field_text(v.value), '[$,\s]', '', 'g')::numeric) end
    where v.field_id = p_field;
  elsif p_type = 'date' then
    for r in select project_id, app.field_text(value) as txt from public.project_field_values where field_id = p_field loop
      begin d := r.txt::date; exception when others then d := null; end;
      update public.project_field_values set value = case when d is null then null else to_jsonb(to_char(d, 'YYYY-MM-DD')) end
      where field_id = p_field and project_id = r.project_id;
    end loop;
  elsif p_type = 'checkbox' then
    update public.project_field_values v set value = case
      when lower(coalesce(app.field_text(v.value), '')) in ('yes', 'y', 'true', '1', 'x', 'done', 'checked', 'on') then 'true'::jsonb end
    where v.field_id = p_field;
  elsif p_type in ('text', 'url') then
    update public.project_field_values v set value = to_jsonb(app.field_text(v.value)) where v.field_id = p_field;
  else
    -- Person and Files hold ids, which text cannot be matched to, so they start empty.
    delete from public.project_field_values where field_id = p_field;
  end if;
  delete from public.project_field_values where field_id = p_field and (value is null or value = 'null'::jsonb);

  update public.custom_fields set type = p_type, options = opts where id = p_field;
end $$;

create or replace function public.duplicate_field(p_field uuid, p_label text default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields;
  nid uuid;
begin
  select * into f from public.custom_fields where id = p_field;
  if not found then raise exception 'That column no longer exists.'; end if;
  if not app.is_admin(f.workspace_id) then raise exception 'Only Super Admins can duplicate a column.'; end if;
  insert into public.custom_fields (workspace_id, label, type, options, visible_roles, editable_roles, on_board, sort)
  values (f.workspace_id, coalesce(nullif(btrim(p_label), ''), f.label || ' copy'), f.type, f.options,
    f.visible_roles, f.editable_roles, f.on_board, f.sort)
  returning id into nid;
  insert into public.project_field_values (project_id, field_id, value)
  select project_id, nid, value from public.project_field_values where field_id = p_field;
  return nid;
end $$;

create or replace function public.delete_field(p_field uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields;
  snap jsonb;
begin
  select * into f from public.custom_fields where id = p_field;
  if not found then raise exception 'That column no longer exists.'; end if;
  if not app.is_admin(f.workspace_id) then raise exception 'Only Super Admins can delete a column.'; end if;
  snap := jsonb_build_object('field', to_jsonb(f), 'values', coalesce((
    select jsonb_agg(jsonb_build_object('project_id', project_id, 'value', value))
    from public.project_field_values where field_id = p_field), '[]'::jsonb));
  delete from public.custom_fields where id = p_field;
  return snap;
end $$;

-- Undo for delete_field: puts the field back with the same id, then the values of projects that still exist.
create or replace function public.restore_field(p_snapshot jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  f public.custom_fields;
begin
  f := jsonb_populate_record(null::public.custom_fields, p_snapshot -> 'field');
  if f.id is null or f.workspace_id is null then raise exception 'Nothing to restore.'; end if;
  if not app.is_admin(f.workspace_id) then raise exception 'Only Super Admins can restore a column.'; end if;
  insert into public.custom_fields select f.*;
  insert into public.project_field_values (project_id, field_id, value)
  select (e ->> 'project_id')::uuid, f.id, e -> 'value'
  from jsonb_array_elements(coalesce(p_snapshot -> 'values', '[]'::jsonb)) e
  where exists (select 1 from public.projects p where p.id = (e ->> 'project_id')::uuid);
  return f.id;
end $$;

revoke execute on function app.field_text(jsonb), app.field_labels(jsonb, boolean),
  public.change_field_type(uuid, public.field_type), public.duplicate_field(uuid, text),
  public.delete_field(uuid), public.restore_field(jsonb) from public, anon;
grant execute on function app.field_text(jsonb), app.field_labels(jsonb, boolean),
  public.change_field_type(uuid, public.field_type), public.duplicate_field(uuid, text),
  public.delete_field(uuid), public.restore_field(jsonb) to authenticated;
