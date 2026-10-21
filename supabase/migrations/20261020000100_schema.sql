-- FTGU production board: extensions, enums and tables.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists moddatetime with schema extensions;

create schema if not exists app;

-- ---------- Enums ----------
create type public.user_role       as enum ('super_admin','editor','designer','sponsor','client');
create type public.member_status   as enum ('invited','active','deactivated');
create type public.account_type    as enum ('client','sponsor');
create type public.portal_status   as enum ('active','invited','off');
create type public.stage           as enum ('in_production','post_production','publishing');
create type public.edit_status     as enum ('assigned','editing','in_review','needs_revision','approved');
create type public.thumb_status    as enum ('not_started','in_design','in_review','needs_revision','done');
create type public.approval_status as enum ('pending','approved','changes_requested');
create type public.dist_kind       as enum ('clipping','newsletter','community','distribute');
create type public.dist_status     as enum ('not_yet','ongoing','drafted','done');
create type public.view_kind       as enum ('table','kanban','list','timeline','calendar');
create type public.perm_resource   as enum ('projects','edits','thumbs','approvals','comments','assets','finance','users','automations','settings');
create type public.perm_action     as enum ('view','create','edit','approve','delete');
create type public.deal_status     as enum ('contracted','invoiced','paid','overdue');
create type public.invoice_status  as enum ('draft','sent','paid','overdue','reminder_sent');
create type public.payout_status   as enum ('pending_approval','scheduled','paid');
create type public.idea_type       as enum ('idea','script','research');
create type public.idea_status     as enum ('draft','in_review','approved','archived');
create type public.log_category    as enum ('project','idea','approval','deletion','admin','access');
create type public.field_type      as enum ('text','number','select','multi_select','date','person','url','checkbox','files');
create type public.brand_kind      as enum ('channel','sponsor');

-- ---------- Identity and tenancy ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  color_index smallint not null default 0,
  timezone text not null default 'America/Chicago',
  mfa_required boolean not null default false,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  status public.member_status not null default 'active',
  views public.view_kind[],
  is_owner boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type public.account_type not null,
  contact_email text not null default '',
  portal_status public.portal_status not null default 'invited',
  allow_portal boolean not null default true,
  allow_drafts boolean not null default true,
  allow_comment boolean not null default true,
  allow_approve boolean not null default false,
  color text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null,
  views public.view_kind[],
  account_id uuid references public.accounts(id) on delete cascade,
  token_hash text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  resent_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  youtube_channel_id text,
  owner_account_id uuid references public.accounts(id) on delete set null,
  is_internal boolean not null default false,
  color text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------- Configuration ----------
create table public.role_permissions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.user_role not null,
  resource public.perm_resource not null,
  action public.perm_action not null,
  allowed boolean not null default false,
  primary key (workspace_id, role, resource, action)
);

create table public.role_board_config (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.user_role not null,
  columns text[] not null default '{}',
  views public.view_kind[] not null default '{table}',
  default_view public.view_kind not null default 'table',
  scope text not null default 'assigned' check (scope in ('assigned','all')),
  card jsonb not null default '{}'::jsonb,
  primary key (workspace_id, role)
);

create table public.project_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  stage public.stage not null,
  sort int not null default 0,
  color_token text not null default 'gray',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, label)
);

create table public.content_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  label text not null,
  color_token text not null default 'gray',
  sort int not null default 0,
  unique (workspace_id, key)
);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  type public.field_type not null default 'text',
  options jsonb not null default '[]'::jsonb,
  visible_roles public.user_role[] not null default '{super_admin}',
  editable_roles public.user_role[] not null default '{super_admin}',
  on_board boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content_type_id uuid references public.content_types(id) on delete set null,
  name text not null,
  steps jsonb not null default '[]'::jsonb,
  default_editor_id uuid references public.profiles(id) on delete set null,
  default_designer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  timezone text not null default 'America/Chicago',
  default_view public.view_kind not null default 'table',
  week_start text not null default 'sun' check (week_start in ('sun','mon')),
  require_sponsor_approval boolean not null default true,
  lock_after_live boolean not null default false,
  editors_change_status boolean not null default false,
  auto_distribution boolean not null default true,
  edit_days int not null default 10,
  thumb_days int not null default 2,
  default_theme text not null default 'light',
  accent text not null default '#16FFDE',
  automation jsonb not null default '{"paused":false,"retry":true,"failAlert":true,"sandbox":false,"retention":"90"}'::jsonb,
  notify_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Production ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_code text not null,
  title text not null,
  channel_id uuid references public.channels(id) on delete set null,
  content_type_id uuid references public.content_types(id) on delete set null,
  status_id uuid not null references public.project_statuses(id),
  film_date date,
  publish_date date,
  link_url text,
  youtube_video_id text,
  template_id uuid references public.templates(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, job_code)
);

create table public.project_edits (
  project_id uuid primary key references public.projects(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null,
  edit_status public.edit_status,
  edit_due date,
  draft_version int not null default 0,
  review_url text,
  updated_at timestamptz not null default now()
);

create table public.project_thumbnails (
  project_id uuid primary key references public.projects(id) on delete cascade,
  designer_id uuid references public.profiles(id) on delete set null,
  thumb_status public.thumb_status,
  thumb_due date,
  final_asset_id uuid,
  updated_at timestamptz not null default now()
);

create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  approval_status public.approval_status not null default 'pending',
  deliverables text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, account_id)
);

create table public.distribution_tasks (
  project_id uuid not null references public.projects(id) on delete cascade,
  kind public.dist_kind not null,
  status public.dist_status not null default 'not_yet',
  assignee_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (project_id, kind)
);

create table public.project_field_values (
  project_id uuid not null references public.projects(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  value jsonb,
  primary key (project_id, field_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  internal boolean not null default true,
  parent_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('script','raw_footage','draft','thumbnail','final','other')),
  name text not null,
  storage_path text,
  external_url text,
  version int not null default 1,
  external_visible boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Workspace pages ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  priority text not null default 'med' check (priority in ('high','med','low')),
  due_at timestamptz,
  done_at timestamptz,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  role text not null default 'user' check (role in ('user','assistant')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind public.brand_kind not null,
  channel_id uuid references public.channels(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  color text,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  tone text[] not null default '{}',
  dos text[] not null default '{}',
  donts text[] not null default '{}',
  sections jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brand_kits(id) on delete cascade,
  type public.idea_type not null default 'idea',
  status public.idea_status not null default 'draft',
  prev_status public.idea_status,
  title text not null,
  hook text,
  body text[] not null default '{}',
  tags text[] not null default '{}',
  refs text[] not null default '{}',
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text not null default '',
  text text not null default '',
  target_label text not null default '',
  quote text,
  project_id uuid references public.projects(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views bigint not null default 0,
  likes bigint not null default 0,
  retention_pct numeric(5,2) not null default 0,
  impressions bigint not null default 0
);

-- ---------- Finance ----------
create table public.project_finance (
  project_id uuid primary key references public.projects(id) on delete cascade,
  budget_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sponsorship_id uuid references public.sponsorships(id) on delete set null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  amount_cents bigint not null default 0,
  status public.deal_status not null default 'contracted',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  number text not null,
  description text not null default '',
  amount_cents bigint not null default 0,
  status public.invoice_status not null default 'draft',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  description text not null default '',
  amount_cents bigint not null default 0,
  status public.payout_status not null default 'pending_approval',
  pay_date date,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Automation and audit ----------
create table public.integrations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  name text not null,
  description text not null default '',
  tone text not null default 'blue',
  status text not null default 'disconnected' check (status in ('connected','disconnected')),
  config jsonb not null default '{}'::jsonb,
  vault_secret_id uuid,
  connected_by uuid references public.profiles(id) on delete set null,
  sort int not null default 0,
  primary key (workspace_id, provider)
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null default 'custom' check (category in ('production','sponsor','publishing','custom')),
  name text not null,
  when_text text not null default '',
  then_text text not null default '',
  app text not null default '',
  "trigger" jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  flow jsonb not null default '[["t"],["a"]]'::jsonb,
  enabled boolean not null default true,
  is_draft boolean not null default false,
  run_count int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  status text not null default 'queued',
  payload jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text not null default '',
  category public.log_category not null,
  action text not null,
  target_type text,
  target_id uuid,
  target_label text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  idea_id uuid references public.ideas(id) on delete set null,
  source text not null default 'web' check (source in ('web','automation','api','portal','mobile')),
  external_visible boolean not null default false,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index on public.workspace_members (user_id, workspace_id) where status = 'active';
create index on public.account_members (user_id);
create index on public.invitations (lower(email)) where accepted_at is null;
create index on public.projects (workspace_id, status_id);
create index on public.projects (workspace_id, publish_date);
create index on public.projects (channel_id);
create index on public.project_edits (editor_id);
create index on public.project_thumbnails (designer_id);
create index on public.sponsorships (account_id);
create index on public.sponsorships (project_id);
create index on public.comments (project_id, created_at);
create index on public.project_assets (project_id);
create index on public.activity_log (workspace_id, created_at desc);
create index on public.activity_log (project_id);
create index on public.activity_log (idea_id);
create index on public.notifications (user_id, read_at);
create index on public.ideas (brand_id);
create index on public.idea_comments (idea_id);
create index on public.tasks (owner_id);
create index on public.ai_threads (user_id);
create index on public.ai_messages (thread_id);
create index on public.content_metrics (project_id);
create index projects_title_trgm on public.projects using gin (title extensions.gin_trgm_ops);

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['workspaces','profiles','workspace_members','accounts','projects','project_edits','project_thumbnails',
    'sponsorships','distribution_tasks','comments','ai_threads','brand_kits','ideas','project_finance','deals','invoices','payouts',
    'automations','workspace_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function extensions.moddatetime(updated_at)', t);
  end loop;
end $$;
