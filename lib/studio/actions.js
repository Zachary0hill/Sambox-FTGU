// Every write the board makes. Calls run with the signed-in user's session, so RLS, column guards and
// workflow triggers decide what sticks. UI updates optimistically and reloads on failure.
import {
  EDIT_V, THUMB_V, APPROVAL_V, DIST_V, IDEA_TYPE_V, IDEA_STATUS_V, FIELD_TYPE_V, DB_ROLES, isoOf, dateOfLabel, startOfDay,
} from './model';

const DIST_KEYS = ['clipping', 'newsletter', 'community', 'distribute'];

export function makeActions({ sb, getD, setD, getMe, toast, reload, reloadPortal, switchAccount }) {
  const ws = () => getD().ws.id;
  const me = () => getMe();
  const fail = (err) => {
    const msg = (err && (err.message || err.error_description)) || 'Something went wrong.';
    toast(msg);
    reload();
  };
  const check = (res) => { if (res && res.error) throw res.error; return res ? res.data : null; };
  const patchRow = (id, patch) => setD((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const isoFor = (label, extra) => (extra && extra.iso) || (label ? isoOf(dateOfLabel(label, startOfDay(new Date()))) : null);

  async function log(category, action, target, opts = {}) {
    const res = await sb.rpc('log_activity', {
      p_category: category, p_action: action, p_target_label: target || '',
      p_project: opts.projectId || null, p_idea: opts.ideaId || null, p_event: opts.event || null,
      p_quote: opts.quote || null, p_external: !!opts.external,
    });
    if (res.error) console.warn('log_activity', res.error.message);
  }

  // monday: copy a linked project's new status to its monday item. Fire and forget; failures show as a toast.
  function pushMonday(projectId) {
    fetch('/api/monday/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
      .then((res) => (res.ok ? null : res.json().then((j) => toast('monday: ' + ((j && j.error) || 'status not updated.')))))
      .catch(() => {});
  }

  // One field of one project. Returns a promise so callers can chain.
  async function writeField(r, k, val, extra = {}) {
    const D = getD();
    const pid = r.id;
    if (k === 'status') {
      const st = D.statuses.find((x) => x.label === val);
      const res = check(await sb.from('projects').update({ status_id: st ? st.id : r.statusId }).eq('id', pid));
      if (r.mondayItemId) pushMonday(pid);
      return res;
    }
    if (k === 'type') {
      const t = D.types.find((x) => x.label === val);
      return check(await sb.from('projects').update({ content_type_id: t ? t.id : null }).eq('id', pid));
    }
    if (k === 'channel') {
      const c = D.channels.find((x) => x.name === val);
      return check(await sb.from('projects').update({ channel_id: c ? c.id : null }).eq('id', pid));
    }
    if (k === 'film' || k === 'pub') {
      return check(await sb.from('projects').update({ [k === 'film' ? 'film_date' : 'publish_date']: val ? isoFor(val, extra) : null }).eq('id', pid));
    }
    if (k === 'linkUrl') return check(await sb.from('projects').update({ link_url: val || null }).eq('id', pid));
    if (k === 'editor' || k === 'editStatus' || k === 'editDue') {
      const row = { project_id: pid };
      if (k === 'editor') {
        row.editor_id = val ? (D.directory.find((p) => p.name === val && p.role === 'editor') || {}).id || null : null;
        if (val && !r.editStatus) row.edit_status = 'assigned';
      }
      if (k === 'editStatus') row.edit_status = val ? EDIT_V[val] : null;
      if (k === 'editDue') row.edit_due = val ? isoFor(val, extra) : null;
      if (r.editorId || r.editStatus || r.editDue) {
        const { project_id, ...upd } = row;
        return check(await sb.from('project_edits').update(upd).eq('project_id', project_id));
      }
      return check(await sb.from('project_edits').upsert(row, { onConflict: 'project_id' }));
    }
    if (k === 'designer' || k === 'thumb' || k === 'thumbDue') {
      const row = { project_id: pid };
      if (k === 'designer') {
        row.designer_id = val ? (D.directory.find((p) => p.name === val && p.role === 'designer') || {}).id || null : null;
        if (val && !r.thumb) row.thumb_status = 'not_started';
      }
      if (k === 'thumb') row.thumb_status = val ? THUMB_V[val] : null;
      if (k === 'thumbDue') row.thumb_due = val ? isoFor(val, extra) : null;
      if (r.designerId || r.thumb || r.thumbDue) {
        const { project_id, ...upd } = row;
        return check(await sb.from('project_thumbnails').update(upd).eq('project_id', project_id));
      }
      return check(await sb.from('project_thumbnails').upsert(row, { onConflict: 'project_id' }));
    }
    if (k === 'sponsor') {
      if (!val) return check(await sb.from('sponsorships').delete().eq('project_id', pid));
      const a = D.accounts.find((x) => x.name === val);
      if (!a) throw new Error('Unknown sponsor ' + val);
      if (r.sponsorshipId) return check(await sb.from('sponsorships').update({ account_id: a.id, approval_status: 'pending', decided_at: null, decided_by: null }).eq('id', r.sponsorshipId));
      return check(await sb.from('sponsorships').insert({ project_id: pid, account_id: a.id }));
    }
    if (k === 'approval') {
      if (!r.sponsorshipId) throw new Error('Add a sponsor before setting approval.');
      return check(await sb.from('sponsorships').update({ approval_status: APPROVAL_V[val] || 'pending', decided_by: me().id, decided_at: new Date().toISOString() }).eq('id', r.sponsorshipId));
    }
    if (DIST_KEYS.indexOf(k) >= 0) {
      if (!val) return check(await sb.from('distribution_tasks').delete().eq('project_id', pid).eq('kind', k));
      return check(await sb.from('distribution_tasks').upsert({ project_id: pid, kind: k, status: DIST_V[val] }, { onConflict: 'project_id,kind' }));
    }
    if (D.customFields.some((f) => f.id === k)) {
      return check(await sb.from('project_field_values').upsert({ project_id: pid, field_id: k, value: val === '' ? null : val }, { onConflict: 'project_id,field_id' }));
    }
    throw new Error('That field cannot be edited here.');
  }

  const optimisticFor = (k, val, extra) => {
    const p = { [k]: val };
    if (k === 'status' && extra.stage) p.g = extra.stage;
    return p;
  };
  const EVENT = { status: 'status', editStatus: 'status', thumb: 'status', approval: 'approval', editor: 'assign', designer: 'assign' };

  async function setField(r, k, val, extra = {}) {
    patchRow(r.id, optimisticFor(k, val, extra));
    try {
      await writeField(r, k, val, extra);
      await log(k === 'approval' ? 'approval' : 'project', extra.text || ('updated ' + k + ' on'), r.title, {
        projectId: r.id, event: extra.event || EVENT[k] || null,
        external: k === 'status' && (val === 'Scheduled' || val === 'Live' || val === 'Sponsor Review'),
      });
      reload();
    } catch (err) { fail(err); }
  }

  async function applyPatch(r, patch, opts = {}) {
    const opt = {};
    Object.keys(patch).forEach((k) => Object.assign(opt, optimisticFor(k, patch[k], opts)));
    patchRow(r.id, opt);
    try {
      let cur = r;
      for (const k of Object.keys(patch)) { await writeField(cur, k, patch[k], opts); cur = { ...cur, [k]: patch[k] }; }
      await log(Object.keys(patch).includes('approval') ? 'approval' : 'project', (opts.text || 'updated') + ' on', r.title, { projectId: r.id, event: opts.event || null, external: !!opts.external });
      reload();
    } catch (err) { fail(err); }
  }

  async function postComment(r, text, internal) {
    const m = me();
    if (m.uiRole === 'sponsor') {
      try {
        check(await sb.rpc('portal_add_comment', { p: r.id, acct: getD().account.id, p_body: text }));
        patchRow(r.id, { commentCount: (r.commentCount || 0) + 1 });
        reloadPortal(r.id);
      } catch (err) { fail(err); }
      return;
    }
    const temp = { id: 'tmp-' + Date.now(), project_id: r.id, author_id: m.id, body: text, internal: !!internal, created_at: new Date().toISOString() };
    setD((d) => ({ ...d, comments: { ...d.comments, [r.id]: (d.comments[r.id] || []).concat([temp]) }, rows: d.rows.map((x) => (x.id === r.id ? { ...x, commentCount: (x.commentCount || 0) + 1 } : x)) }));
    try {
      check(await sb.from('comments').insert({ project_id: r.id, author_id: m.id, body: text, internal: !!internal }));
      await log('project', 'commented on', r.title, { projectId: r.id, event: 'comment', quote: text, external: !internal });
      reload();
    } catch (err) { fail(err); }
  }

  async function decide(r, decision, note) {
    patchRow(r.id, { approval: decision === 'approved' ? 'Approved' : 'Changes Requested' });
    try {
      check(await sb.rpc('portal_decide_sponsorship', { p_sponsorship: r.sponsorshipId, p_decision: decision, p_note: note || null }));
      toast(decision === 'approved' ? 'Approved. The team has been notified.' : 'Changes requested. The team has been notified.');
      reload();
    } catch (err) { fail(err); }
  }

  async function toggleTask(t) {
    const done = t.done_at ? null : new Date().toISOString();
    setD((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done_at: done } : x)) }));
    try { check(await sb.from('tasks').update({ done_at: done }).eq('id', t.id)); } catch (err) { fail(err); }
  }

  async function addTask(text) {
    try {
      const row = check(await sb.from('tasks').insert({ workspace_id: ws(), owner_id: me().id, text: text, priority: 'med' }).select().single());
      setD((d) => ({ ...d, tasks: d.tasks.concat([row]) }));
    } catch (err) { fail(err); }
  }

  async function markRead(ids) {
    if (!ids.length) return;
    const at = new Date().toISOString();
    setD((d) => ({ ...d, notifications: d.notifications.map((n) => (ids.indexOf(n.id) >= 0 ? { ...n, read_at: at } : n)) }));
    try { check(await sb.from('notifications').update({ read_at: at }).in('id', ids)); } catch (err) { fail(err); }
  }

  // Inbox Messages: read state is one row per person and item.
  async function markInboxRead(ids) {
    if (!ids.length) return;
    setD((d) => ({ ...d, inbox: (d.inbox || []).map((x) => (ids.indexOf(x.id) >= 0 ? { ...x, read: true } : x)) }));
    try {
      check(await sb.from('inbox_reads').upsert(ids.map((id) => ({ item_id: id, user_id: me().id })), { onConflict: 'item_id,user_id', ignoreDuplicates: true }));
    } catch (err) { fail(err); }
  }

  async function sendChat(threadId, title, text) {
    try {
      let id = threadId;
      if (!id) {
        const th = check(await sb.from('ai_threads').insert({ workspace_id: ws(), user_id: me().id, title: title }).select().single());
        id = th.id;
      } else {
        check(await sb.from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', id));
      }
      check(await sb.from('ai_messages').insert({ thread_id: id, role: 'user', body: text }));
      await reload();
      return id;
    } catch (err) { fail(err); return null; }
  }

  // Daily assistant with an AI model: /api/assistant stores both turns and streams NDJSON lines
  // ({t:'thread'|'text'|'tool'|'error'|'done'}). onEvent gets {type:'thread', id}, {type:'tool', name} and the reply so far
  // as {type:'text', text}, throttled so the board does not re-render on every token.
  async function askAssistant(threadId, title, text, onEvent) {
    const out = { threadId, text: '', error: '', noModel: false, proposals: [] };
    let res;
    try {
      res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, title, text }) });
    } catch {
      out.error = 'Could not reach the assistant. Check your connection and try again.';
      return out;
    }
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      out.error = j.error || 'The assistant could not answer (HTTP ' + res.status + ').';
      out.noModel = j.code === 'no_model';
      return out;
    }
    let timer = null;
    const flush = () => { timer = null; onEvent({ type: 'text', text: out.text }); };
    const handle = (ev) => {
      if (ev.t === 'thread') { out.threadId = ev.id; onEvent({ type: 'thread', id: ev.id }); }
      else if (ev.t === 'text') { out.text += ev.d || ''; if (!timer) timer = setTimeout(flush, 80); }
      else if (ev.t === 'tool') onEvent({ type: 'tool', name: ev.name });
      else if (ev.t === 'proposal' && ev.p) { out.proposals = out.proposals.concat([ev.p]); onEvent({ type: 'proposal', proposals: out.proposals }); }
      else if (ev.t === 'error') out.error = ev.message || 'The assistant could not finish this answer.';
    };
    try {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line) { try { handle(JSON.parse(line)); } catch { /* skip a malformed line */ } }
        }
      }
    } catch {
      out.error = out.error || 'The connection dropped before the answer finished.';
    }
    if (timer) { clearTimeout(timer); flush(); }
    await reload();
    return out;
  }

  // The member clicked Create on an assistant proposal card: remember it on the stored reply so the card stays done.
  async function markProposalDone(messageId, index) {
    if (!messageId) return;
    const row = await sb.from('ai_messages').select('meta').eq('id', messageId).maybeSingle();
    const meta = (row.data && row.data.meta) || {};
    const list = Array.isArray(meta.proposals) ? meta.proposals.slice() : [];
    if (!list[index]) return;
    list[index] = { ...list[index], done: true };
    const res = await sb.from('ai_messages').update({ meta: { ...meta, proposals: list } }).eq('id', messageId);
    if (res.error) console.warn('ai_messages', res.error.message);
  }

  // ---------- Ideas ----------
  async function updateIdea(i, p, text) {
    const db = {};
    if (p.title !== undefined) db.title = p.title;
    if (p.type !== undefined) db.type = IDEA_TYPE_V[p.type];
    if (p.status !== undefined) db.status = IDEA_STATUS_V[p.status];
    if (p.prev !== undefined) db.prev_status = p.prev ? IDEA_STATUS_V[p.prev] : null;
    if (p.tags !== undefined) db.tags = p.tags;
    if (p.body !== undefined) db.body = p.body;
    setD((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === i.id ? { ...x, ...p } : x)) }));
    try {
      check(await sb.from('ideas').update(db).eq('id', i.id));
      await log('idea', text, p.title || i.title, { ideaId: i.id, event: 'idea' });
      reload();
    } catch (err) { fail(err); }
  }
  async function deleteIdea(i) {
    try {
      await log('deletion', 'permanently deleted the idea', i.title, {});
      check(await sb.from('ideas').delete().eq('id', i.id));
      setD((d) => ({ ...d, ideas: d.ideas.filter((x) => x.id !== i.id) }));
      reload();
    } catch (err) { fail(err); }
  }
  async function commentIdea(i, text) {
    try {
      check(await sb.from('idea_comments').insert({ idea_id: i.id, author_id: me().id, body: text }));
      await log('idea', 'commented on the idea', i.title, { ideaId: i.id, event: 'idea', quote: text });
      reload();
    } catch (err) { fail(err); }
  }
  async function createIdea({ title, brandId, type, body }) {
    const row = check(await sb.from('ideas').insert({ workspace_id: ws(), brand_id: brandId, type: IDEA_TYPE_V[type] || 'idea', title: title, body: body, author_id: me().id }).select().single());
    await log('idea', 'created the idea', title, { ideaId: row.id, event: 'idea' });
    await reload();
    return row.id;
  }
  // Research agent: the server runs the sources and the model with the Super Admin's keys; the page only sees progress.
  async function researchCall(path, method, body) {
    const res = await fetch('/api/research' + (path || ''), {
      method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'The request failed (' + res.status + ').');
    return out;
  }
  async function startResearch(input) {
    const out = await researchCall('', 'POST', input);
    toast('Research started. Ideas land here as Drafts when it finishes.');
    await reload();
    return out.id;
  }
  async function cancelResearch(id) {
    try {
      await researchCall('/' + id, 'DELETE');
      toast('Research cancelled.');
    } catch (err) { toast(err.message); }
    await reload();
  }

  // ---------- Profile and preferences ----------
  let nameTimer = null;
  function saveProfileName(name) {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(async () => {
      if (!String(name || '').trim()) return;
      try { check(await sb.from('profiles').update({ full_name: name.trim() }).eq('id', me().id)); } catch (err) { fail(err); }
    }, 700);
  }
  async function changeEmail(email) {
    const res = await sb.auth.updateUser({ email: email });
    if (res.error) return toast(res.error.message);
    toast('Check both inboxes to confirm the new email.');
  }
  let prefTimer = null, prefPending = {};
  function savePrefs(patch) {
    prefPending = { ...prefPending, ...patch };
    clearTimeout(prefTimer);
    prefTimer = setTimeout(async () => {
      const m = me();
      const next = { ...(m.prefs || {}), ...prefPending };
      prefPending = {};
      m.prefs = next;
      try { check(await sb.from('profiles').update({ prefs: next }).eq('id', m.id)); } catch (err) { console.warn(err); }
    }, 400);
  }
  async function resetPassword() {
    const res = await sb.auth.resetPasswordForEmail(me().email, { redirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent('/auth/setup?type=recovery') });
    toast(res.error ? res.error.message : 'Password reset link sent to ' + me().email + '.');
  }
  async function signOut(scope) {
    await sb.auth.signOut({ scope: scope || 'local' });
    window.location.href = window.location.origin + '/login';
  }

  // ---------- Admin ----------
  async function savePermissions(map) {
    try {
      check(await sb.rpc('save_permissions', { p_map: map }));
      await log('admin', 'updated permissions for', 'all user types');
      toast('Permissions saved. They apply on the next action each person takes.');
      await reload();
    } catch (err) { fail(err); throw err; }
  }
  async function setRoleViews(uiRole, views, text, label) {
    try {
      check(await sb.from('role_board_config').update({ views: views }).eq('workspace_id', ws()).in('role', DB_ROLES[uiRole]));
      await log('admin', text, label);
      reload();
    } catch (err) { fail(err); }
  }
  async function updateSettings(patch, text, target) {
    setD((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    try {
      check(await sb.from('workspace_settings').update(patch).eq('workspace_id', ws()));
      if (text) await log('admin', text, target || '');
    } catch (err) { fail(err); }
  }
  async function updateAccount(raw, patch, text) {
    setD((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === raw.id ? { ...a, ...patch } : a)) }));
    try {
      const upd = { ...patch };
      if (patch.allow_portal === true && raw.portal_status === 'off') upd.portal_status = 'invited';
      check(await sb.from('accounts').update(upd).eq('id', raw.id));
      await log('access', text, raw.name);
      reload();
    } catch (err) { fail(err); }
  }
  async function removeAccount(raw) {
    try {
      check(await sb.from('accounts').delete().eq('id', raw.id));
      await log('deletion', 'removed the account', raw.name);
      reload();
    } catch (err) { fail(err); }
  }
  async function addAccount({ name, type, contact_email }) {
    const a = check(await sb.from('accounts').insert({ workspace_id: ws(), name, type, contact_email, portal_status: 'invited', allow_approve: type === 'sponsor' }).select().single());
    if (type === 'client') {
      const ch = check(await sb.from('channels').insert({ workspace_id: ws(), name, owner_account_id: a.id, sort: 100 }).select().single());
      check(await sb.from('brand_kits').insert({ workspace_id: ws(), name, kind: 'channel', channel_id: ch.id, account_id: a.id }));
    } else {
      check(await sb.from('brand_kits').insert({ workspace_id: ws(), name, kind: 'sponsor', account_id: a.id }));
    }
    await log('admin', 'added the ' + (type === 'client' ? 'client' : 'sponsor') + ' account', name);
    await reload();
  }
  async function setFinStatus(table, id, status, text, target) {
    try {
      check(await sb.from(table).update({ status }).eq('id', id));
      await log(status === 'paid' || status === 'scheduled' ? 'approval' : 'admin', text, target);
      reload();
    } catch (err) { fail(err); }
  }
  async function updateAutomation(raw, patch, text) {
    setD((d) => ({ ...d, automations: d.automations.map((a) => (a.id === raw.id ? { ...a, ...patch } : a)) }));
    try {
      check(await sb.from('automations').update(patch).eq('id', raw.id));
      await log('admin', text, raw.name);
    } catch (err) { fail(err); }
  }
  async function deleteAutomation(raw) {
    setD((d) => ({ ...d, automations: d.automations.filter((a) => a.id !== raw.id) }));
    try {
      check(await sb.from('automations').delete().eq('id', raw.id));
      await log('deletion', 'deleted the automation', raw.name);
    } catch (err) { fail(err); }
  }
  async function createAutomation(row) {
    try {
      check(await sb.from('automations').insert({ workspace_id: ws(), ...row }));
      await log('admin', 'created the automation', row.name);
      await reload();
    } catch (err) { fail(err); throw err; }
  }
  // Integration keys go through the server: it checks the key with the provider, then stores it in Vault.
  async function integrationCall(provider, method, path, body) {
    const res = await fetch('/api/integrations/' + provider + (path || ''), {
      method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'The request failed (' + res.status + ').');
    return out;
  }
  async function saveIntegration(g, fields) {
    try {
      await integrationCall(g.provider, 'POST', '', { fields });
      toast(g.name + ' is connected.');
      await reload();
      return true;
    } catch (err) { toast(err.message); await reload(); return false; }
  }
  // The models an AI key can use. An empty apiKey means the saved key. Throws with the provider's reason.
  async function listModels(provider, apiKey) {
    const out = await integrationCall(provider, 'POST', '/models', { apiKey: apiKey || '' });
    return Array.isArray(out.models) ? out.models : [];
  }
  async function disconnectIntegration(g) {
    try {
      await integrationCall(g.provider, 'DELETE');
      toast(g.name + ' is disconnected. Its key was deleted.');
    } catch (err) { toast(err.message); }
    await reload();
  }
  async function syncIntegration(g) {
    try {
      const out = await integrationCall(g.provider, 'POST', '/sync');
      toast(out.summary || g.name + ' is up to date.');
    } catch (err) { toast(err.message); }
    await reload();
  }
  function exportCsv(rows, name) {
    const esc = (v) => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = String(name || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + isoOf(new Date()) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveWorkspace(w) {
    try {
      check(await sb.from('workspaces').update({ name: w.name }).eq('id', ws()));
      check(await sb.from('workspace_settings').update({ timezone: w.tz, default_view: w.view, week_start: w.week }).eq('workspace_id', ws()));
      await log('admin', 'saved workspace settings for', w.name);
      toast('Workspace settings saved.');
      await reload();
    } catch (err) { fail(err); throw err; }
  }
  async function removeStatus(x) {
    try {
      check(await sb.from('project_statuses').delete().eq('id', x.id));
      await log('deletion', 'removed the status', x.label);
      reload();
    } catch (err) { fail(err); }
  }
  async function addStatus(label, stage, sort) {
    try {
      check(await sb.from('project_statuses').insert({ workspace_id: ws(), label, stage, sort: sort + 100, color_token: 'gray' }));
      await log('admin', 'added the status', label);
      reload();
    } catch (err) { fail(err); }
  }
  async function addChannel(name) {
    const D = getD();
    check(await sb.from('channels').insert({ workspace_id: ws(), name, sort: (D.channels.length + 1) * 100 }));
    await log('admin', 'added the channel', name);
    await reload();
  }
  async function removeField(f) {
    try {
      check(await sb.from('custom_fields').delete().eq('id', f.id));
      await log('deletion', 'deleted the custom field', f.label);
      reload();
    } catch (err) { fail(err); }
  }
  async function setFieldRoles(f, uiRoles) {
    const roles = Array.from(new Set(['super_admin'].concat(...uiRoles.map((r) => DB_ROLES[r] || []))));
    setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === f.id ? { ...x, visible_roles: roles } : x)) }));
    try { check(await sb.from('custom_fields').update({ visible_roles: roles }).eq('id', f.id)); } catch (err) { fail(err); }
  }
  // Resolves to the new field's id (null on failure) so the board can point at the new column.
  async function addField({ label, type, onBoard }) {
    try {
      const id = crypto.randomUUID();
      check(await sb.from('custom_fields').insert({ id, workspace_id: ws(), label, type: FIELD_TYPE_V[type] || 'text', on_board: !!onBoard, visible_roles: ['super_admin'], editable_roles: ['super_admin'], sort: 100 }));
      await log('admin', onBoard ? 'added the board column' : 'added the custom field', label);
      await reload();
      if (onBoard) toast('Added the ' + label + ' column.');
      return id;
    } catch (err) { fail(err); return null; }
  }
  // Invite emails go out through Resend from the /api/invites routes (secret key stays on the server).
  async function postJson(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ').');
    return data;
  }
  const mailNote = (data, ok, who) => data.emailSent ? ok : who + ' The email did not send: ' + (data.emailError || 'unknown error') + '.';
  async function resendInvite(raw) {
    try {
      const data = await postJson('/api/invites/resend', { invitationId: raw.id });
      await log('access', 'resent the invite to', raw.full_name || raw.email);
      toast(mailNote(data, 'Invite email sent again to ' + raw.email + '.', 'Invite renewed.'));
      reload();
    } catch (err) { fail(err); }
  }
  async function setMemberStatus(raw, status, text, name) {
    try {
      check(await sb.from('workspace_members').update({ status }).eq('workspace_id', raw.workspace_id).eq('user_id', raw.user_id));
      await log('admin', text, name);
      reload();
    } catch (err) { fail(err); }
  }
  async function setMemberRole(raw, role, verb, name, roleText) {
    try {
      check(await sb.from('workspace_members').update({ role, views: null }).eq('workspace_id', raw.workspace_id).eq('user_id', raw.user_id));
      await log('access', verb, name + ' ' + roleText);
      toast(name + (role === 'super_admin' ? ' is now a Super Admin.' : ' is now an Editor.'));
      reload();
    } catch (err) { fail(err); }
  }
  async function removeMember(m) {
    try {
      if (m.isInvite) check(await sb.from('invitations').delete().eq('id', m.raw.id));
      else check(await sb.from('workspace_members').delete().eq('workspace_id', m.raw.workspace_id).eq('user_id', m.raw.user_id));
      await log('deletion', 'removed', m.name);
      reload();
    } catch (err) { fail(err); }
  }
  async function inviteMember({ email, name, role, views, accountId, roleLabel }) {
    const data = await postJson('/api/invites', { email, name, role, views, accountId });
    await log('admin', 'invited ' + name + ' as', roleLabel);
    toast(data.status === 'added'
      ? mailNote(data, name + ' already had an account. They now have access and got an email.', name + ' already had an account and now has access.')
      : mailNote(data, 'Invite emailed to ' + email + '.', 'Invite saved.'));
    await reload();
  }

  // ---------- Files ----------
  async function openAsset(a, r) {
    try {
      if (a.storage_path) {
        const res = await sb.storage.from('project-assets').createSignedUrl(a.storage_path, 3600);
        if (res.error) throw res.error;
        return window.open(res.data.signedUrl, '_blank', 'noopener');
      }
      if (a.external_url) return window.open(a.external_url, '_blank', 'noopener');
      if ((a.kind === 'final' || a.kind === 'draft') && r.linkUrl) return window.open(r.linkUrl, '_blank', 'noopener');
      toast('No file is attached yet. Upload one from this tab.');
    } catch (err) { toast(err.message); }
  }
  function pickAndUpload(r, kind) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const D = getD();
      const list = D.assets[r.id] || [];
      const version = kind === 'draft' ? list.filter((a) => a.kind === 'draft').reduce((m, a) => Math.max(m, a.version || 1), 0) + 1 : 1;
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-');
      const path = ws() + '/' + r.id + '/' + kind + '/' + version + '-' + Date.now() + '-' + safe;
      toast('Uploading ' + file.name + '…');
      try {
        const up = await sb.storage.from('project-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (up.error) throw up.error;
        const name = kind === 'draft' ? 'Edit v' + version : kind === 'thumbnail' ? (r.thumb === 'Done' ? 'Thumbnail final' : 'Thumbnail concepts') : file.name;
        check(await sb.from('project_assets').insert({ project_id: r.id, kind, name, storage_path: path, version, uploaded_by: me().id }));
        if (kind === 'draft' && r.editorId === me().id || (kind === 'draft' && me().uiRole === 'admin' && (r.editorId || r.editStatus))) {
          await sb.from('project_edits').update({ draft_version: version }).eq('project_id', r.id);
        }
        await log('project', kind === 'draft' ? 'uploaded draft v' + version + ' for' : 'uploaded ' + name + ' for', r.title, { projectId: r.id, event: 'status' });
        toast('Uploaded ' + file.name + '.');
        reload();
      } catch (err) { fail(err); }
    };
    input.click();
  }

  // ---------- Archive and delete projects ----------
  // Archived projects leave the board; Live ones still count on the Content page. Delete is only offered on
  // archived projects, and removes the project's uploaded files from storage too.
  async function archiveProject(r, on) {
    patchRow(r.id, { archived: on });
    try {
      check(await sb.from('projects').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', r.id));
      await log('project', on ? 'archived the project' : 'restored the project', r.title, { projectId: r.id });
      toast(on ? r.title + ' is archived. Show archived projects from the board\'s More menu.' : r.title + ' is back on the board.');
      reload();
    } catch (err) { fail(err); }
  }
  async function deleteProject(r) {
    try {
      const paths = (getD().assets[r.id] || []).map((a) => a.storage_path).filter(Boolean);
      if (paths.length) await sb.storage.from('project-assets').remove(paths);
      await log('deletion', 'permanently deleted the project', r.title + ' (' + r.job + ')');
      check(await sb.from('projects').delete().eq('id', r.id));
      setD((d) => ({ ...d, rows: d.rows.filter((x) => x.id !== r.id) }));
      toast(r.title + ' was deleted.');
      reload();
    } catch (err) { fail(err); }
  }

  // ---------- Brands ----------
  // A channel brand gets its own channel so projects on that channel link to it. A sponsor brand is linked to a
  // sponsor account (account 'new' creates one with the portal off), since that link is what lets the sponsor and
  // the team see it. account '' leaves it unlinked: Super Admins only.
  async function createBrand({ name, kind, account }) {
    const D = getD();
    let channelId = null, accountId = null;
    if (kind === 'channel') {
      const ch = D.channels.find((c) => c.name.toLowerCase() === name.toLowerCase())
        || check(await sb.from('channels').insert({ workspace_id: ws(), name, sort: (D.channels.length + 1) * 100 }).select().single());
      channelId = ch.id;
    } else if (account === 'new') {
      const a = D.accounts.find((x) => x.type === 'sponsor' && x.name.toLowerCase() === name.toLowerCase())
        || check(await sb.from('accounts').insert({ workspace_id: ws(), name, type: 'sponsor', portal_status: 'off', allow_approve: true }).select().single());
      accountId = a.id;
    } else if (account) {
      accountId = account;
    }
    const row = check(await sb.from('brand_kits').insert({ workspace_id: ws(), name, kind, channel_id: channelId, account_id: accountId }).select().single());
    await log('admin', 'added the brand', name);
    await reload();
    return row.id;
  }
  async function updateBrand(kit, patch) {
    setD((d) => ({ ...d, brands: d.brands.map((b) => (b.id === kit.id ? { ...b, ...patch } : b)) }));
    try {
      check(await sb.from('brand_kits').update(patch).eq('id', kit.id));
      // Projects link to a channel brand by channel name, so keep the two names together.
      if (kit.channel_id && patch.name && patch.name !== kit.name) check(await sb.from('channels').update({ name: patch.name }).eq('id', kit.channel_id));
      await log('admin', 'updated the brand', patch.name || kit.name);
      reload();
    } catch (err) { fail(err); }
  }
  async function deleteBrand(kit) {
    try {
      const paths = (kit.assets || []).map((a) => a && a.path).filter(Boolean);
      if (paths.length) await sb.storage.from('brand-assets').remove(paths);
      check(await sb.from('brand_kits').delete().eq('id', kit.id));
      await log('deletion', 'deleted the brand', kit.name);
      reload();
    } catch (err) { fail(err); }
  }
  function uploadBrandFile(kit, kind) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (kind === 'logo') input.accept = 'image/*';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      toast('Uploading ' + (files.length === 1 ? files[0].name : files.length + ' files') + '…');
      try {
        const added = [];
        for (const file of files) {
          const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-');
          const path = ws() + '/' + kit.id + '/' + kind + '/' + Date.now() + '-' + safe;
          const up = await sb.storage.from('brand-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
          if (up.error) throw up.error;
          added.push({ kind, name: file.name, path, size: file.size, type: file.type || '', at: new Date().toISOString() });
        }
        const cur = (getD().brands.find((b) => b.id === kit.id) || kit).assets || [];
        check(await sb.from('brand_kits').update({ assets: cur.concat(added) }).eq('id', kit.id));
        await log('admin', 'uploaded ' + (kind === 'logo' ? 'a logo' : 'a file') + ' for', kit.name);
        toast('Uploaded ' + (files.length === 1 ? files[0].name : files.length + ' files') + '.');
        reload();
      } catch (err) { fail(err); }
    };
    input.click();
  }
  async function openBrandFile(a) {
    try {
      const res = await sb.storage.from('brand-assets').createSignedUrl(a.path, 3600, { download: a.name });
      if (res.error) throw res.error;
      window.open(res.data.signedUrl, '_blank', 'noopener');
    } catch (err) { toast(err.message); }
  }
  async function removeBrandFile(kit, a) {
    const next = (kit.assets || []).filter((x) => !(x && x.path === a.path));
    setD((d) => ({ ...d, brands: d.brands.map((b) => (b.id === kit.id ? { ...b, assets: next } : b)) }));
    try {
      await sb.storage.from('brand-assets').remove([a.path]);
      check(await sb.from('brand_kits').update({ assets: next }).eq('id', kit.id));
      await log('deletion', 'removed ' + a.name + ' from', kit.name);
      reload();
    } catch (err) { fail(err); }
  }

  // ---------- Projects ----------
  async function createProject({ title, job, channel, type, status, film, pub, sponsor, template }) {
    const D = getD();
    const st = D.statuses.find((x) => x.label === status) || D.statuses[0];
    const ch = D.channels.find((x) => x.name === channel);
    const ct = D.types.find((x) => x.label === type);
    // The id is made here because insert-returning runs pr_select, whose has_project_access() can't see the row yet.
    const p = { id: crypto.randomUUID() };
    check(await sb.from('projects').insert({
      id: p.id, workspace_id: ws(), job_code: job, title, channel_id: ch ? ch.id : null, content_type_id: ct ? ct.id : null, status_id: st.id,
      film_date: film || null, publish_date: pub || null, template_id: template ? template.id : null, created_by: me().id,
    }));
    const addDays = (iso, n) => { if (!iso) return null; const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
    const s = D.settings || {};
    if (template && template.default_editor_id) check(await sb.from('project_edits').insert({ project_id: p.id, editor_id: template.default_editor_id, edit_status: 'assigned', edit_due: addDays(film, s.edit_days ?? 10) }));
    if (template && template.default_designer_id) check(await sb.from('project_thumbnails').insert({ project_id: p.id, designer_id: template.default_designer_id, thumb_status: 'not_started', thumb_due: addDays(pub, -(s.thumb_days ?? 2)) }));
    if (sponsor) {
      const a = D.accounts.find((x) => x.name === sponsor);
      if (a) check(await sb.from('sponsorships').insert({ project_id: p.id, account_id: a.id }));
    }
    await log('project', 'created the project', title, { projectId: p.id });
    await reload();
    return true;
  }

  return {
    toast, log: (cat, text, target) => log(cat, text, target).then(reload), reload, switchAccount,
    setField, applyPatch, postComment, decide, toggleTask, addTask, markRead, sendChat, askAssistant, markProposalDone,
    updateIdea, deleteIdea, commentIdea, createIdea, startResearch, cancelResearch,
    saveProfileName, changeEmail, savePrefs, resetPassword, signOut,
    savePermissions, setRoleViews, updateSettings, updateAccount, removeAccount, addAccount, setFinStatus,
    updateAutomation, deleteAutomation, createAutomation, archiveProject, deleteProject, saveIntegration, listModels, disconnectIntegration, syncIntegration, exportCsv, saveWorkspace,
    removeStatus, addStatus, addChannel, removeField, setFieldRoles, addField, resendInvite, setMemberStatus, setMemberRole, removeMember, inviteMember,
    openAsset, pickAndUpload, createProject,
    createBrand, updateBrand, deleteBrand, uploadBrandFile, openBrandFile, removeBrandFile,
    markInboxRead,
  };
}
