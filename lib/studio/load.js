// Loads everything the signed-in user may see. Row visibility comes from RLS and the portal RPCs.
import {
  EDIT_L, THUMB_L, APPROVAL_L, DIST_L, IDEA_TYPE_L, IDEA_STATUS_L, STAGE_ID, UI_ROLE, labelOf, first, isImageFile,
} from './model';

const must = (res, what) => {
  if (res.error) throw new Error((what ? what + ': ' : '') + res.error.message);
  return res.data || [];
};
const byId = (list, key = 'id') => Object.fromEntries((list || []).map((x) => [x[key], x]));
const groupBy = (list, key) => {
  const out = {};
  (list || []).forEach((x) => { (out[x[key]] = out[x[key]] || []).push(x); });
  return out;
};

// Daily assistant: whether an AI model is connected, from /api/assistant (members cannot read integrations).
// Cached for 30 seconds so realtime reloads do not refetch it every time.
let aiCache = null;
function assistantInfo() {
  if (typeof fetch === 'undefined') return Promise.resolve({ enabled: false });
  if (aiCache && Date.now() - aiCache.at < 30000) return aiCache.p;
  const p = fetch('/api/assistant', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { enabled: false })).catch(() => ({ enabled: false }));
  aiCache = { at: Date.now(), p };
  return p;
}

export async function loadContext(sb) {
  const res = await sb.rpc('my_context');
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

export async function loadWorkspace(sb, ctx, accountId) {
  const ws = ctx.workspace_id;
  const uiRole = UI_ROLE[ctx.role];
  const external = uiRole === 'sponsor';
  const account = external ? (ctx.accounts.find((a) => a.id === accountId) || ctx.accounts[0] || null) : null;
  const q = (t) => sb.from(t).select('*').eq('workspace_id', ws);
  const aiP = assistantInfo();

  const common = await Promise.all([
    sb.from('workspaces').select('id, name, slug').eq('id', ws).single(),
    q('workspace_settings').maybeSingle(),
    q('project_statuses').order('sort'),
    q('content_types').order('sort'),
    q('channels').order('sort'),
    q('accounts').order('name'),
    sb.rpc('directory'),
    sb.from('ideas').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }),
    sb.from('idea_comments').select('*').order('created_at'),
    q('brand_kits').order('created_at'),
    sb.from('notifications').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(200),
    sb.from('activity_log').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(400),
    sb.from('ai_threads').select('*, ai_messages(*)').eq('workspace_id', ws).order('updated_at', { ascending: false }),
    q('role_board_config'),
    q('custom_fields').order('sort'),
  ]);
  const [wsRes, setRes, stRes, ctRes, chRes, acRes, dirRes, ideaRes, icRes, bkRes, nRes, logRes, thRes, rcRes, cfRes] = common;
  const statuses = must(stRes, 'statuses');
  const types = must(ctRes, 'content types');
  const channels = must(chRes, 'channels');
  const accounts = must(acRes, 'accounts');
  const directory = must(dirRes, 'directory');
  const people = byId(directory);

  let projects = [], edits = [], thumbs = [], spons = [], dist = [], comments = [], assets = [], tasks = [];
  let members = [], invitations = [], metrics = [], budgets = [], deals = [], invoices = [], payouts = [];
  let automations = [], integrations = [], fieldValues = [], templates = [], rolePerms = [];
  let portalRows = [], profiles = [];
  // YouTube videos from the sync (Content page). Started now so it runs alongside the reads below.
  const ytP = external ? null : sb.from('youtube_videos').select('*').eq('workspace_id', ws).order('published_at', { ascending: false }).limit(1000).then((x) => x, (error) => ({ error }));
  // Buffer channels and sent posts with metrics (Content > Social), internal roles only.
  const bufP = external ? null : Promise.all([
    sb.from('buffer_channels').select('*').eq('workspace_id', ws).order('service'),
    sb.from('buffer_posts').select('*').eq('workspace_id', ws).order('sent_at', { ascending: false, nullsFirst: false }).limit(1000),
  ]).then((x) => x, (error) => [{ error }, { error }]);
  // Inbox Messages (Slack; Buffer once its API shares comments), internal roles only. inbox_reads comes back as this person's own reads.
  // This person's saved board views (column order, widths, frozen, wrap, sort, group by). RLS returns only their own rows.
  const viewP = sb.from('board_view_state').select('*').eq('workspace_id', ws).then((x) => x, (error) => ({ error }));
  const inboxP = external ? null : sb.from('inbox_items').select('*, inbox_reads(read_at)').eq('workspace_id', ws).order('occurred_at', { ascending: false }).limit(300).then((x) => x, (error) => ({ error }));

  if (!external) {
    const r = await Promise.all([
      sb.from('projects').select('*').eq('workspace_id', ws).order('created_at'),
      sb.from('project_edits').select('*'),
      sb.from('project_thumbnails').select('*'),
      sb.from('sponsorships').select('*').order('created_at'),
      sb.from('distribution_tasks').select('*'),
      sb.from('comments').select('*').order('created_at'),
      sb.from('project_assets').select('*').order('created_at'),
      sb.from('tasks').select('*').eq('workspace_id', ws).order('created_at'),
      sb.from('workspace_members').select('*').eq('workspace_id', ws).order('created_at'),
      q('invitations').is('accepted_at', null).order('created_at'),
      sb.from('content_metrics').select('*').order('captured_at', { ascending: false }),
      sb.from('project_finance').select('*'),
      q('deals').order('created_at'),
      q('invoices').order('created_at'),
      q('payouts').order('created_at'),
      q('automations').order('created_at'),
      q('integrations').order('sort'),
      sb.from('project_field_values').select('*'),
      q('templates').order('created_at'),
      q('role_permissions'),
      sb.from('profiles').select('id, email'),
    ]);
    [projects, edits, thumbs, spons, dist, comments, assets, tasks, members, invitations, metrics, budgets, deals,
      invoices, payouts, automations, integrations, fieldValues, templates, rolePerms, profiles] = r.map((x, i) => must(x, 'load ' + i));
  } else if (account) {
    portalRows = must(await sb.rpc('portal_projects', { acct: account.id }), 'portal');
  }
  // Research agent runs, Super Admin only. A missing table or error leaves the list empty.
  const rrRes = uiRole === 'admin' ? await sb.from('research_runs').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(8) : null;
  const researchRuns = rrRes && !rrRes.error ? rrRes.data || [] : [];

  const st = byId(statuses), ct = byId(types), ch = byId(channels), acc = byId(accounts);
  const editOf = byId(edits, 'project_id'), thumbOf = byId(thumbs, 'project_id');
  const sponOf = {};
  spons.forEach((s) => { if (!sponOf[s.project_id]) sponOf[s.project_id] = s; });
  const distOf = groupBy(dist, 'project_id');
  const cmtOf = groupBy(comments, 'project_id');
  const fvOf = groupBy(fieldValues, 'project_id');

  let rows;
  if (!external) {
    rows = projects.map((p) => {
      const s = st[p.status_id] || {};
      const e = editOf[p.id] || {};
      const t = thumbOf[p.id] || {};
      const sp = sponOf[p.id] || null;
      const d = Object.fromEntries((distOf[p.id] || []).map((x) => [x.kind, DIST_L[x.status]]));
      const row = {
        id: p.id, job: p.job_code, title: p.title,
        channel: (ch[p.channel_id] || {}).name || '', channelId: p.channel_id,
        type: (ct[p.content_type_id] || {}).label || '', typeId: p.content_type_id,
        status: s.label || '', statusId: p.status_id, g: STAGE_ID[s.stage] || 'prod',
        film: labelOf(p.film_date), pub: labelOf(p.publish_date),
        editor: e.editor_id ? (people[e.editor_id] || {}).name || '' : '', editorId: e.editor_id || null,
        editStatus: EDIT_L[e.edit_status] || '', editDue: labelOf(e.edit_due), draftVersion: e.draft_version || 0,
        designer: t.designer_id ? (people[t.designer_id] || {}).name || '' : '', designerId: t.designer_id || null,
        thumb: THUMB_L[t.thumb_status] || '', thumbDue: labelOf(t.thumb_due),
        sponsor: sp ? (acc[sp.account_id] || {}).name || '' : '', sponsorAccountId: sp ? sp.account_id : null,
        sponsorshipId: sp ? sp.id : null, approval: sp ? APPROVAL_L[sp.approval_status] : '', deliverables: sp ? sp.deliverables || '' : '',
        clipping: d.clipping || '', newsletter: d.newsletter || '', community: d.community || '', distribute: d.distribute || '',
        linkUrl: p.link_url || '', archived: !!p.archived_at, createdAt: p.created_at, createdBy: p.created_by,
        commentCount: (cmtOf[p.id] || []).length, mondayItemId: p.monday_item_id || null,
      };
      // Custom values: row[id] is the display text (Multi select joins with commas), row.cf[id] the stored value.
      row.cf = {};
      (fvOf[p.id] || []).forEach((fv) => {
        row.cf[fv.field_id] = fv.value;
        row[fv.field_id] = fv.value == null ? '' : Array.isArray(fv.value) ? fv.value.join(', ') : String(fv.value);
      });
      return row;
    });
  } else {
    rows = portalRows.map((p) => ({
      id: p.id, job: p.job_code, title: p.title, channel: p.channel || '', type: p.content_type || '',
      status: p.status, statusId: null, g: STAGE_ID[p.stage] || 'prod',
      film: labelOf(p.film_date), pub: labelOf(p.publish_date),
      editor: '', editStatus: '', editDue: '', designer: '', thumb: '', thumbDue: '',
      sponsor: p.sponsor || '', sponsorAccountId: p.sponsor ? account.id : null, sponsorshipId: p.sponsorship_id,
      approval: p.approval ? APPROVAL_L[p.approval] : '', deliverables: p.deliverables || '',
      clipping: '', newsletter: '', community: '', distribute: '', linkUrl: p.link_url || '', archived: false,
      createdAt: null, commentCount: p.comment_count || 0, statusSort: p.status_sort,
    }));
  }

  const nameOf = (id) => (people[id] || {}).name || '';
  // Channels first in channel order (internal channel leads), then sponsors A to Z.
  const chSort = Object.fromEntries(channels.map((c) => [c.id, (c.is_internal ? 0 : 1000) + (c.sort || 0)]));
  const brands = must(bkRes, 'brands').slice().sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'channel' ? -1 : 1) || ((chSort[a.channel_id] || 0) - (chSort[b.channel_id] || 0)) || a.name.localeCompare(b.name));
  // Brand logos render as previews, so sign their URLs up front (one call for every brand).
  const logoPaths = brands.flatMap((b) => (b.assets || []).filter((a) => a && a.kind === 'logo' && a.path).map((a) => a.path));
  if (logoPaths.length) {
    const signed = await sb.storage.from('brand-assets').createSignedUrls(logoPaths, 3600);
    const urlOf = Object.fromEntries((signed.data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    brands.forEach((b) => { b.logoUrls = urlOf; });
  }
  const bk = byId(brands);
  // Project images render as previews in the drawer's Files and Comments tabs.
  const previews = await signPreviews(sb, assets);
  const ideaComments = groupBy(must(icRes, 'idea comments'), 'idea_id');
  const activity = must(logRes, 'activity');
  const ideaHist = groupBy(activity.filter((l) => l.idea_id), 'idea_id');
  const authorLabel = (uid) => {
    const p = people[uid];
    if (!p) return 'Team';
    return (p.role === 'sponsor' || p.role === 'client') && p.account ? p.account : p.name;
  };
  const ideas = must(ideaRes, 'ideas').map((i) => ({
    id: i.id, title: i.title, brand: (bk[i.brand_id] || {}).name || '', brandId: i.brand_id,
    type: IDEA_TYPE_L[i.type], status: IDEA_STATUS_L[i.status], prev: i.prev_status ? IDEA_STATUS_L[i.prev_status] : '',
    by: authorLabel(i.author_id), byId: i.author_id, date: labelOf(i.created_at), hook: i.hook || '',
    body: i.body || [], tags: i.tags || [], refs: i.refs || [],
    comments: (ideaComments[i.id] || []).map((c) => ({ id: c.id, who: authorLabel(c.author_id), whoId: c.author_id, at: c.created_at, text: c.body })),
    hist: (ideaHist[i.id] || []).map((h) => ({ who: h.actor_label, whoId: h.actor_id, text: h.action, at: h.created_at })),
  }));

  const threads = must(thRes, 'threads').map((t) => {
    const msgs = (t.ai_messages || []).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.role === 'user' ? -1 : 1))
      .map((m) => ({ id: m.id, role: m.role, body: m.body, at: m.created_at, meta: m.meta || {} }));
    return { id: t.id, title: t.title, at: t.updated_at, msgs, q: msgs.filter((m) => m.role === 'user').map((m) => m.body) };
  });
  const assistant = await aiP;

  const memberRows = members.map((m) => ({ ...m, person: people[m.user_id] || { name: '', full_name: '' } }));
  const ytRes = ytP ? await ytP : null;
  if (ytRes && ytRes.error) console.warn('youtube_videos', ytRes.error.message);
  const youtube = ytRes && !ytRes.error ? ytRes.data || [] : [];
  const bufRes = bufP ? await bufP : [null, null];
  bufRes.forEach((x, i) => { if (x && x.error) console.warn(i ? 'buffer_posts' : 'buffer_channels', x.error.message); });
  const buffer = { channels: bufRes[0] && !bufRes[0].error ? bufRes[0].data || [] : [], posts: bufRes[1] && !bufRes[1].error ? bufRes[1].data || [] : [] };
  const inboxRes = inboxP ? await inboxP : null;
  if (inboxRes && inboxRes.error) console.warn('inbox_items', inboxRes.error.message);
  const viewRes = await viewP;
  if (viewRes.error) console.warn('board_view_state', viewRes.error.message);
  const viewStates = !viewRes.error ? viewRes.data || [] : [];
  const inbox = inboxRes && !inboxRes.error ? (inboxRes.data || []).map((x) => ({ ...x, read: !!(x.inbox_reads && x.inbox_reads.length) })) : [];

  return {
    ws: must(wsRes), settings: setRes.data || {}, statuses, types, channels, accounts, directory, people,
    rows, comments: cmtOf, assets: groupBy(assets, 'project_id'), previews, tasks, ideas, brands,
    notifications: must(nRes, 'notifications'), activity, threads, assistant,
    members: memberRows, invitations, metrics, budgets, deals, invoices, payouts,
    automations, integrations, customFields: must(cfRes, 'fields'), templates, rolePerms,
    roleConfigs: must(rcRes, 'board config'), account, authorLabel, nameOf,
    profileEmail: Object.fromEntries(profiles.map((p) => [p.id, p.email])), portalDetail: {},
    researchRuns,
    youtube,
    buffer,
    inbox,
    viewStates,
  };
}

// Sponsor and client drawers read comments and files through the portal RPCs.
export async function loadPortalDetail(sb, projectId, accountId) {
  const [c, a] = await Promise.all([
    sb.rpc('portal_comments', { p: projectId, acct: accountId }),
    sb.rpc('portal_assets', { p: projectId, acct: accountId }),
  ]);
  const comments = must(c, 'comments'), assets = must(a, 'assets');
  const previews = await signPreviews(sb, assets.concat(comments.flatMap((x) => x.attachments || [])));
  return { comments, assets, previews };
}

// One signed URL per image file, keyed by storage path. URLs last an hour and are reused for 50 minutes, so
// realtime reloads do not make every preview download again. A failed call leaves those previews out.
const signed = new Map();
async function signPreviews(sb, assets) {
  const now = Date.now();
  const paths = [...new Set(assets.filter((a) => a && a.storage_path && isImageFile(a)).map((a) => a.storage_path))];
  const missing = paths.filter((p) => !(signed.get(p) && now - signed.get(p).at < 50 * 60 * 1000));
  if (missing.length) {
    const res = await sb.storage.from('project-assets').createSignedUrls(missing, 3600);
    if (res.error) console.warn('previews', res.error.message);
    (res.data || []).forEach((x) => { if (x.signedUrl) signed.set(x.path, { url: x.signedUrl, at: now }); });
  }
  return Object.fromEntries(paths.filter((p) => signed.get(p)).map((p) => [p, signed.get(p).url]));
}

export { first };
