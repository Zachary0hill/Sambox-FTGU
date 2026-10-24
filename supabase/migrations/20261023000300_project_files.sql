-- Project drawer Files and Comments: files remember their type and size, and a file can belong to a comment
-- (images and documents attached while commenting). Those files also show in the Files tab.

alter table public.project_assets
  add column if not exists comment_id uuid references public.comments(id) on delete cascade,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;
create index if not exists project_assets_comment_idx on public.project_assets (comment_id) where comment_id is not null;

-- Files uploaded by someone else show up without a refresh.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_assets') then
    alter publication supabase_realtime add table public.project_assets;
  end if;
end $$;

-- Sponsors and clients see the files attached to comments they can read. Attachments on internal comments are
-- saved with external_visible = false, so they never appear here or pass the storage read policy.
drop function if exists public.portal_comments(uuid, uuid);
create function public.portal_comments(p uuid, acct uuid)
returns table (id uuid, author_id uuid, author_label text, author_role public.user_role, body text, created_at timestamptz, attachments jsonb)
language sql stable security definer set search_path = '' as $$
  select cm.id, cm.author_id, coalesce(nullif(split_part(pf.full_name, ' ', 1), ''), 'Team'), wm.role, cm.body, cm.created_at,
         (select coalesce(jsonb_agg(jsonb_build_object('id', pa.id, 'name', pa.name, 'storage_path', pa.storage_path,
                    'mime_type', pa.mime_type, 'size_bytes', pa.size_bytes, 'created_at', pa.created_at) order by pa.created_at), '[]'::jsonb)
          from public.project_assets pa where pa.comment_id = cm.id and pa.external_visible)
  from public.comments cm
  join public.projects pr on pr.id = cm.project_id
  left join public.profiles pf on pf.id = cm.author_id
  left join public.workspace_members wm on wm.workspace_id = pr.workspace_id and wm.user_id = cm.author_id
  where cm.project_id = p and not cm.internal and app.portal_can(acct, p)
  order by cm.created_at
$$;
revoke execute on function public.portal_comments(uuid, uuid) from public, anon;
grant execute on function public.portal_comments(uuid, uuid) to authenticated;
