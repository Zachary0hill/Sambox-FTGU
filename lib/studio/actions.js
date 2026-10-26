// Every write the board makes. Calls run with the signed-in user's session, so RLS, column guards and
// workflow triggers decide what sticks. UI updates optimistically and reloads on failure.
import {
  EDIT_V, THUMB_V, APPROVAL_V, DIST_V, IDEA_TYPE_V, IDEA_STATUS_V, IDEA_FORMAT_V, IDEA_EFFORT_V, FIELD_TYPE_V, DB_ROLES, STAGE_ID, isoOf, dateOfLabel, startOfDay,
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
    if (opts.event) sendEmails();
  }

  // Email notifications and automations: database triggers queue them and this asks the server to send and run what
  // is waiting. Debounced, so a burst of edits makes one call each. The scheduled ticks pick up anything a closed tab
  // leaves behind.
  let mailTimer = null;
  function sendEmails() {
    clearTimeout(mailTimer);
    mailTimer = setTimeout(() => {
      fetch('/api/notifications/send', { method: 'POST' }).catch(() => {});
      fetch('/api/automations/run', { method: 'POST' }).then((r) => (r.ok && me() && me().uiRole === 'admin' ? reload() : null)).catch(() => {});
    }, 1500);
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
    if (k === 'title') {
      const t = String(val || '').trim();
      if (!t) throw new Error('A project needs a name.');
      return check(await sb.from('projects').update({ title: t }).eq('id', pid));
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
    if (k === 'brief') return check(await sb.from('projects').update({ brief: String(val || '').trim() || null }).eq('id', pid));
    if (k === 'editor' || k === 'editStatus' || k === 'editDue') {
      const row = { project_id: pid };
      if (k === 'editor') {
        row.editor_id = val ? (D.directory.find((p) => p.name === val && p.role === 'editor') || {}).id || null : null;
        if (val && !r.editStatus) row.edit_status = 'assigned';
        // Unassigning undoes the automatic Assigned, so the Pipeline never says Assigned with nobody on it.
        if (!val && r.editStatus === 'Assigned') row.edit_status = null;
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
        if (!val && r.thumb === 'Not Started') row.thumb_status = null;
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
  // Statuses marked "Notify sponsor" log to the sponsor portal (project_statuses.notify_sponsor).
  const notifiesSponsor = (label) => !!(getD().statuses.find((x) => x.label === label) || {}).notify_sponsor;

  async function setField(r, k, val, extra = {}) {
    patchRow(r.id, optimisticFor(k, val, extra));
    try {
      await writeField(r, k, val, extra);
      sendEmails();
      await log(k === 'approval' ? 'approval' : 'project', extra.text || ('updated ' + k + ' on'), r.title, {
        projectId: r.id, event: extra.event || EVENT[k] || null,
        external: k === 'status' && notifiesSponsor(val),
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
      sendEmails();
      await log(Object.keys(patch).includes('approval') ? 'approval' : 'project', (opts.text || 'updated') + ' on', r.title, { projectId: r.id, event: opts.event || null, external: !!opts.external });
      reload();
    } catch (err) { fail(err); }
  }

  // Files picked in the comment box upload first, then the comment, then one project_assets row per file linked
  // to it, so they show in the comment and in the Files tab. Attachments on client-visible comments are shared.
  async function postComment(r, text, internal, files) {
    const m = me();
    const picked = (files || []).map((f) => (f.file ? f : { file: f }));
    const list = picked.map((f) => f.file);
    if (m.uiRole === 'sponsor') {
      try {
        check(await sb.rpc('portal_add_comment', { p: r.id, acct: getD().account.id, p_body: text }));
        patchRow(r.id, { commentCount: (r.commentCount || 0) + 1 });
        reloadPortal(r.id);
      } catch (err) { fail(err); }
      return;
    }
    const id = crypto.randomUUID();
    const temp = { id, project_id: r.id, author_id: m.id, body: text, internal: !!internal, created_at: new Date().toISOString(), pending: picked.map((f) => ({ name: f.file.name, size_bytes: f.file.size, mime_type: f.file.type, url: f.url || '' })) };
    setD((d) => ({ ...d, comments: { ...d.comments, [r.id]: (d.comments[r.id] || []).concat([temp]) }, rows: d.rows.map((x) => (x.id === r.id ? { ...x, commentCount: (x.commentCount || 0) + 1 } : x)) }));
    const uploaded = [];
    try {
      for (const f of list) uploaded.push({ file: f, path: await putFile(r, 'comments/' + id, f) });
      check(await sb.from('comments').insert({ id, project_id: r.id, author_id: m.id, body: text, internal: !!internal }));
      if (uploaded.length) {
        check(await sb.from('project_assets').insert(uploaded.map((u) => ({
          project_id: r.id, kind: 'other', name: u.file.name, storage_path: u.path, uploaded_by: m.id, comment_id: id,
          mime_type: u.file.type || null, size_bytes: u.file.size, external_visible: !internal,
        }))));
      }
      await log('project', uploaded.length && !text ? 'attached ' + fileCount(uploaded.length) + ' to' : 'commented on', r.title, { projectId: r.id, event: 'comment', quote: text || null, external: !internal });
      reload();
    } catch (err) {
      if (uploaded.length) await sb.storage.from('project-assets').remove(uploaded.map((u) => u.path));
      fail(err);
    }
  }
  const fileCount = (n) => n + (n === 1 ? ' file' : ' files');
  // Uploads one file under <workspace>/<project>/<folder>/ and returns its storage path.
  async function putFile(r, folder, file, prefix) {
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '-');
    const path = ws() + '/' + r.id + '/' + folder + '/' + (prefix ? prefix + '-' : '') + Date.now() + '-' + safe;
    const up = await sb.storage.from('project-assets').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) throw up.error;
    return path;
  }

  async function editComment(r, c, text) {
    setD((d) => ({ ...d, comments: { ...d.comments, [r.id]: (d.comments[r.id] || []).map((x) => (x.id === c.id ? { ...x, body: text, updated_at: new Date().toISOString() } : x)) } }));
    try {
      check(await sb.from('comments').update({ body: text }).eq('id', c.id));
      await log('project', 'edited a comment on', r.title, { projectId: r.id, quote: text });
      reload();
    } catch (err) { fail(err); }
  }
  // Attachments stay in the project's Files tab.
  async function deleteComment(r, c) {
    setD((d) => ({ ...d, comments: { ...d.comments, [r.id]: (d.comments[r.id] || []).filter((x) => x.id !== c.id) }, rows: d.rows.map((x) => (x.id === r.id ? { ...x, commentCount: Math.max(0, (x.commentCount || 1) - 1) } : x)) }));
    try {
      check(await sb.from('comments').delete().eq('id', c.id));
      await log('deletion', 'deleted a comment on', r.title, { projectId: r.id });
      reload();
    } catch (err) { fail(err); }
  }

  async function decide(r, decision, note) {
    patchRow(r.id, { approval: decision === 'approved' ? 'Approved' : 'Changes Requested' });
    try {
      check(await sb.rpc('portal_decide_sponsorship', { p_sponsorship: r.sponsorshipId, p_decision: decision, p_note: note || null }));
      sendEmails();
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

  // Activity Log > Load older: the next 400 entries before the oldest one shown.
  async function loadOlderActivity() {
    const d = getD();
    const all = (d.activity || []).concat(d.olderActivity || []);
    const oldest = all.reduce((m, l) => (!m || l.created_at < m ? l.created_at : m), '');
    try {
      const rows = check(await sb.from('activity_log').select('*').eq('workspace_id', ws()).lt('created_at', oldest || new Date().toISOString()).order('created_at', { ascending: false }).limit(400)) || [];
      setD((x) => ({ ...x, olderActivity: (x.olderActivity || []).concat(rows), activityEnd: rows.length < 400 }));
      if (!rows.length) toast('That is the whole history.');
    } catch (err) { toast(err.message); }
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
  // ({t:'thread'|'think'|'thought'|'text'|'tool'|'tool-done'|'proposal'|'error'|'done'}). onEvent gets {type:'thread', id},
  // {type:'tool'|'tool-done', name}, {type:'thought', ms} and the reasoning and reply so far as {type:'text', text, thinking},
  // throttled so the board does not re-render on every token. opts: { provider, model, mode, signal } (signal = Stop).
  async function askAssistant(threadId, title, text, onEvent, opts) {
    const o = opts || {};
    const out = { threadId, text: '', thinking: '', thinkMs: 0, error: '', noModel: false, stopped: false, proposals: [] };
    let res;
    try {
      res = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: o.signal,
        body: JSON.stringify({ threadId, title, text, provider: o.provider || undefined, model: o.model || undefined, mode: o.mode || undefined }),
      });
    } catch (err) {
      if (err && err.name === 'AbortError') { out.stopped = true; return out; }
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
    const flush = () => { timer = null; onEvent({ type: 'text', text: out.text, thinking: out.thinking }); };
    const handle = (ev) => {
      if (ev.t === 'thread') { out.threadId = ev.id; onEvent({ type: 'thread', id: ev.id }); }
      else if (ev.t === 'text') { out.text += ev.d || ''; if (!timer) timer = setTimeout(flush, 50); }
      else if (ev.t === 'think') { out.thinking += ev.d || ''; if (!timer) timer = setTimeout(flush, 50); }
      else if (ev.t === 'thought') { out.thinkMs = ev.ms || 0; onEvent({ type: 'thought', ms: out.thinkMs }); }
      else if (ev.t === 'tool' || ev.t === 'tool-done') onEvent({ type: ev.t, name: ev.name });
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
    } catch (err) {
      if (err && err.name === 'AbortError') out.stopped = true;
      else out.error = out.error || 'The connection dropped before the answer finished.';
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
  // Board field names to ideas columns. Only the keys present in p are written.
  const ideaDb = (p) => {
    const db = {};
    const has = (k) => p[k] !== undefined;
    const nz = (v) => (v === '' || v == null ? null : v);
    if (has('title')) db.title = p.title;
    if (has('type')) db.type = IDEA_TYPE_V[p.type];
    if (has('status')) db.status = IDEA_STATUS_V[p.status];
    if (has('prev')) db.prev_status = p.prev ? IDEA_STATUS_V[p.prev] : null;
    if (has('tags')) db.tags = p.tags;
    if (has('body')) db.body = p.body;
    if (has('refs')) db.refs = p.refs;
    if (has('hook')) db.hook = nz(p.hook);
    if (has('format')) db.format = IDEA_FORMAT_V[p.format] || null;
    if (has('pillar')) db.pillar = nz(p.pillar);
    if (has('audience')) db.audience = nz(p.audience);
    if (has('promise')) db.promise = nz(p.promise);
    if (has('platforms')) db.platforms = p.platforms;
    if (has('ice')) { db.impact = p.ice[0]; db.confidence = p.ice[1]; db.ease = p.ice[2]; }
    if (has('priority')) db.priority = p.priority;
    if (has('effort')) db.effort = IDEA_EFFORT_V[p.effort] || null;
    if (has('ownerId')) db.owner_id = nz(p.ownerId);
    if (has('window')) db.target_window = nz(p.window);
    if (has('sponsorId')) db.sponsor_id = nz(p.sponsorId);
    if (has('projectId')) db.project_id = nz(p.projectId);
    if (has('researchRunId')) db.research_run_id = nz(p.researchRunId);
    if (has('coverMode')) db.cover_mode = p.coverMode;
    if (has('coverPath')) db.cover_path = nz(p.coverPath);
    if (has('focal')) { db.cover_focal_x = p.focal[0]; db.cover_focal_y = p.focal[1]; }
    if (has('highlight')) db.cover_highlight = p.highlight;
    if (has('hookPos')) db.hook_position = p.hookPos;
    return db;
  };
  async function updateIdea(i, p, text) {
    const db = ideaDb(p);
    const before = getD().ideas.find((x) => x.id === i.id);
    setD((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === i.id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)) }));
    try {
      check(await sb.from('ideas').update(db).eq('id', i.id));
      if (p.coverPath === '' && i.coverPath) await sb.storage.from('idea-covers').remove([i.coverPath]);
      if (text) await log('idea', text, p.title || i.title, { ideaId: i.id, event: 'idea' });
      reload();
      return true;
    } catch (err) {
      // Put the card back right away; the reload in fail() confirms what is stored.
      if (before) setD((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === i.id ? before : x)) }));
      fail(err);
      return false;
    }
  }
  async function deleteIdea(i) {
    try {
      await log('deletion', 'permanently deleted the idea', i.title, {});
      check(await sb.from('ideas').delete().eq('id', i.id));
      if (i.coverPath) await sb.storage.from('idea-covers').remove([i.coverPath]);
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
  // Uploads a cover image to idea-covers under <workspace>/<idea>/ and returns its storage path.
  const COVER_MAX = 10 * 1024 * 1024;
  async function putCover(ideaId, file) {
    if (!file || !/^image\//.test(file.type || '')) throw new Error('Covers must be an image file.');
    if (file.size > COVER_MAX) throw new Error('Covers can be up to 10 MB.');
    const ext = (file.name.match(/\.([A-Za-z0-9]+)$/) || [, 'jpg'])[1].toLowerCase();
    const path = ws() + '/' + ideaId + '/cover-' + Date.now() + '.' + ext;
    const up = await sb.storage.from('idea-covers').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) throw up.error;
    return path;
  }
  // After a reload brings the signed cover URL, keep showing the local file until the signed image has downloaded,
  // so the banner never flashes empty. A later reload simply shows the signed URL.
  function keepLocalCover(id, local) {
    const it = getD().ideas.find((x) => x.id === id);
    const url = it && it.coverUrl;
    if (!url || url === local) return;
    const swap = (from, to) => setD((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === id && x.coverUrl === from ? { ...x, coverUrl: to } : x)) }));
    swap(url, local);
    const img = new Image();
    let done = false;
    const finish = () => { if (done) return; done = true; swap(local, url); setTimeout(() => URL.revokeObjectURL(local), 1000); };
    img.onload = finish; img.onerror = finish; setTimeout(finish, 10000);
    img.src = url;
  }
  // Sets a new cover: shows the local file right away, uploads it, saves the path, then removes the old file.
  async function setIdeaCover(i, file, extra) {
    const local = URL.createObjectURL(file);
    setD((d) => ({ ...d, ideas: d.ideas.map((x) => (x.id === i.id ? { ...x, coverUrl: local, coverMode: x.coverMode === 'hook' ? 'both' : x.coverMode } : x)) }));
    try {
      const path = await putCover(i.id, file);
      const p = { coverPath: path, coverMode: i.coverMode === 'hook' ? 'both' : i.coverMode, focal: [50, 50], ...(extra || {}) };
      check(await sb.from('ideas').update(ideaDb(p)).eq('id', i.id));
      if (i.coverPath && i.coverPath !== path) await sb.storage.from('idea-covers').remove([i.coverPath]);
      await log('idea', 'set the cover image', i.title, { ideaId: i.id });
      await reload();
      keepLocalCover(i.id, local);
      return path;
    } catch (err) { fail(err); return null; }
  }
  async function createIdea(input) {
    const { title, brandId, type, body, cover } = input;
    const extra = ideaDb({ ...input, title: undefined, type: undefined, body: undefined });
    const row = check(await sb.from('ideas').insert({ ...extra, workspace_id: ws(), brand_id: brandId, type: IDEA_TYPE_V[type] || 'idea', title: title, body: body, author_id: me().id }).select().single());
    await log('idea', 'created the idea', title, { ideaId: row.id, event: 'idea' });
    let local = '';
    if (cover) {
      try {
        const path = await putCover(row.id, cover);
        check(await sb.from('ideas').update({ cover_path: path }).eq('id', row.id));
        local = URL.createObjectURL(cover);
      } catch (err) { toast('The idea was saved, but the cover did not upload: ' + err.message); }
    }
    await reload();
    if (local) keepLocalCover(row.id, local);
    return row.id;
  }
  // Promote: the idea links to the project and moves to In production. Resolves false when the link did not save, so
  // New project can retry the link on the project it already made. The brief then lands on the project as an internal
  // comment, so audience, promise, script, references and planning travel with it.
  async function promoteIdea(i, projectId) {
    const ok = await updateIdea(i, { projectId: projectId, status: 'In production', prev: i.status }, 'promoted the idea to a project');
    if (!ok) return false;
    const D = getD();
    const name = (id) => (D.directory.find((x) => x.id === id) || {}).name || '';
    const sponsor = (D.brands.find((b) => b.id === i.sponsorId) || {}).name || '';
    const lines = [
      'Brief from the idea "' + i.title + '"',
      i.hook && 'Hook: ' + i.hook,
      i.audience && 'Audience: ' + i.audience,
      i.promise && 'Viewer takeaway: ' + i.promise,
      [i.format && 'Format: ' + i.format, i.pillar && 'Pillar: ' + i.pillar, i.effort && 'Effort: ' + i.effort, 'Priority: P' + (i.priority || 3)].filter(Boolean).join('  ·  '),
      (i.platforms || []).length ? 'Platforms: ' + i.platforms.join(', ') : '',
      i.window && 'Target window: ' + i.window.slice(0, 7),
      sponsor && 'Sponsor fit: ' + sponsor,
      i.ownerId && name(i.ownerId) && 'Idea owner: ' + name(i.ownerId),
      (i.body || []).length ? '\n' + i.body.join('\n\n') : '',
      (i.refs || []).length ? '\nReferences:\n' + i.refs.join('\n') : '',
    ].filter(Boolean);
    const res = await sb.from('comments').insert({ project_id: projectId, author_id: me().id, body: lines.join('\n'), internal: true });
    if (res.error) toast('The idea is linked, but its brief did not copy to the project: ' + res.error.message);
    reload();
    return true;
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
      try { check(await sb.from('profiles').update({ prefs: next }).eq('id', m.id)); } catch (err) {
        console.warn(err);
        toast('Your settings did not save: ' + ((err && err.message) || 'network error') + '.', { label: 'Retry', run: () => savePrefs(next) });
      }
    }, 400);
  }
  // Two-step sign in: Supabase Auth TOTP factors. enrollMfa returns the QR code and secret; verifyMfa checks the first
  // code, which activates the factor and raises this session to aal2. Studio asks for a code at sign in while the
  // session is aal1 and a verified factor exists.
  async function enrollMfa() {
    const old = await sb.auth.mfa.listFactors();
    for (const f of ((old.data && old.data.all) || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
    const res = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'FTGU Studio ' + new Date().toISOString().slice(0, 10) });
    if (res.error) throw res.error;
    return { factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret };
  }
  async function verifyMfa(factorId, code) {
    const res = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(code || '').replace(/\s+/g, '') });
    if (res.error) throw res.error;
    savePrefs({ mfa: true });
    await log('access', 'turned on two-step sign in for', me().name);
    toast('Two-step sign in is on. You will be asked for a code when you sign in.');
  }
  async function disableMfa() {
    const res = await sb.auth.mfa.listFactors();
    if (res.error) throw res.error;
    for (const f of res.data.all || []) {
      const un = await sb.auth.mfa.unenroll({ factorId: f.id });
      if (un.error) throw un.error;
    }
    savePrefs({ mfa: false });
    await log('access', 'turned off two-step sign in for', me().name);
    toast('Two-step sign in is off.');
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
  // Edit property for built-in columns (step 5): which roles see the column, and its property settings.
  async function setRoleColumns(uiRole, cols, text, label) {
    setD((d) => ({ ...d, roleConfigs: d.roleConfigs.map((rc) => (DB_ROLES[uiRole].indexOf(rc.role) >= 0 ? { ...rc, columns: cols } : rc)) }));
    try {
      check(await sb.from('role_board_config').update({ columns: cols }).eq('workspace_id', ws()).in('role', DB_ROLES[uiRole]));
      if (text) await log('admin', text, label || '');
    } catch (err) { fail(err); }
  }
  // "Save for <role> view": this view becomes the role's starting view (role_board_config.view_state[view]).
  async function saveRoleView(uiRole, view, state, label) {
    const rows = getD().roleConfigs.filter((rc) => DB_ROLES[uiRole].indexOf(rc.role) >= 0);
    const clean = JSON.parse(JSON.stringify(state || {}));
    setD((d) => ({ ...d, roleConfigs: d.roleConfigs.map((rc) => (DB_ROLES[uiRole].indexOf(rc.role) >= 0 ? { ...rc, view_state: { ...(rc.view_state || {}), [view]: clean } } : rc)) }));
    try {
      for (const rc of rows) {
        check(await sb.from('role_board_config').update({ view_state: { ...(rc.view_state || {}), [view]: clean } }).eq('workspace_id', ws()).eq('role', rc.role));
      }
      await log('admin', 'saved the starting ' + view + ' view for', label);
      toast('Saved as the starting ' + label + ' view. People who changed their own view keep theirs.');
    } catch (err) { fail(err); }
  }
  // Set default per role (column presets): merges a patch into the role's starting view instead of replacing it.
  async function patchRoleView(uiRole, view, patch, label, msg) {
    const rows = getD().roleConfigs.filter((rc) => DB_ROLES[uiRole].indexOf(rc.role) >= 0);
    const next = (rc) => ({ ...(rc.view_state || {}), [view]: { ...((rc.view_state || {})[view] || {}), ...patch } });
    setD((d) => ({ ...d, roleConfigs: d.roleConfigs.map((rc) => (DB_ROLES[uiRole].indexOf(rc.role) >= 0 ? { ...rc, view_state: next(rc) } : rc)) }));
    try {
      for (const rc of rows) {
        check(await sb.from('role_board_config').update({ view_state: next(rc) }).eq('workspace_id', ws()).eq('role', rc.role));
      }
      await log('admin', 'changed the starting columns for', label);
      if (msg) toast(msg);
    } catch (err) { fail(err); }
  }
  // Saved column presets (Save current as preset), shared across the workspace.
  function saveColumnPresets(list, text, name) {
    return updateSettings({ column_presets: list }, text, name);
  }
  function setColumnConfig(key, patch) {
    const all = getD().settings.column_config || {};
    return updateSettings({ column_config: { ...all, [key]: { ...(all[key] || {}), ...patch } } });
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
  // Finance records from the record dialog. Throw on failure so the dialog keeps the draft and shows why.
  async function saveFinRecord(table, id, row, text, target) {
    const res = id ? check(await sb.from(table).update(row).eq('id', id).select('id').single())
      : check(await sb.from(table).insert({ workspace_id: ws(), ...row }).select('id').single());
    await log('admin', text, target || '');
    await reload();
    return res.id;
  }
  async function saveBudget(projectId, budgetCents, spentCents, editing) {
    const row = { project_id: projectId, budget_cents: budgetCents, spent_cents: spentCents };
    check(editing ? await sb.from('project_finance').update(row).eq('project_id', projectId) : await sb.from('project_finance').insert(row));
    await log('admin', editing ? 'updated the budget for' : 'added a budget for', (getD().rows.find((r) => r.id === projectId) || {}).title || '');
    await reload();
  }
  async function deleteFinRecord(table, id, text, target) {
    check(await sb.from(table).delete().eq(table === 'project_finance' ? 'project_id' : 'id', id));
    await log('deletion', text, target || '');
    await reload();
  }
  // Emails the invoice (or a reminder) through the server and Resend. Resolves { sent, error }.
  async function sendInvoice(id, reminder) {
    const res = await fetch('/api/finance/invoices/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reminder: !!reminder }) });
    const out = await res.json().catch(() => ({}));
    await reload();
    if (!res.ok) return { sent: false, error: out.error || 'The request failed (' + res.status + ').' };
    if (out.sent) toast((reminder ? 'Reminder emailed to ' : 'Invoice emailed to ') + out.to + '.');
    return out;
  }

  // ---------- Templates and checklists ----------
  async function saveTemplate(raw, row) {
    if (raw) check(await sb.from('templates').update(row).eq('id', raw.id));
    else check(await sb.from('templates').insert({ workspace_id: ws(), ...row }));
    await log('admin', raw ? 'updated the template' : 'created the template', row.name);
    toast(raw ? 'Saved the ' + row.name + ' template.' : 'Created the ' + row.name + ' template.');
    await reload();
  }
  async function deleteTemplate(raw) {
    check(await sb.from('templates').delete().eq('id', raw.id));
    await log('deletion', 'deleted the template', raw.name);
    await reload();
  }
  const patchChecks = (pid, fn) => setD((d) => ({ ...d, checklist: { ...(d.checklist || {}), [pid]: fn((d.checklist || {})[pid] || []) } }));
  // Opening a project's Comments marks them seen (project_reads), which clears the unread dot on its card.
  async function markSeen(r) {
    const at = new Date().toISOString();
    setD((d) => ({ ...d, seen: { ...(d.seen || {}), [r.id]: at } }));
    try { check(await sb.from('project_reads').upsert({ project_id: r.id, user_id: me().id, seen_at: at }, { onConflict: 'project_id,user_id' })); } catch { /* read state is best effort */ }
  }
  async function toggleCheck(r, item) {
    const done = item.done_at ? null : new Date().toISOString();
    patchChecks(r.id, (list) => list.map((x) => (x.id === item.id ? { ...x, done_at: done, done_by: done ? me().id : null } : x)));
    try {
      check(await sb.from('project_checklist').update({ done_at: done }).eq('id', item.id));
      await log('project', (done ? 'checked off ' : 'unchecked ') + item.label + ' on', r.title, { projectId: r.id });
    } catch (err) { fail(err); }
  }
  async function addCheck(r, label) {
    const text = String(label || '').trim();
    if (!text) return;
    const list = (getD().checklist || {})[r.id] || [];
    const row = { id: crypto.randomUUID(), project_id: r.id, label: text, sort: (list.length ? Math.max(...list.map((x) => x.sort)) : 0) + 10 };
    patchChecks(r.id, (l) => l.concat([{ ...row, done_at: null }]));
    try { check(await sb.from('project_checklist').insert(row)); } catch (err) { fail(err); }
  }
  async function removeCheck(r, item) {
    patchChecks(r.id, (list) => list.filter((x) => x.id !== item.id));
    try { check(await sb.from('project_checklist').delete().eq('id', item.id)); } catch (err) { fail(err); }
  }
  // Starts a checklist on an existing project from a template's steps (projects made before checklists existed).
  async function applyTemplate(r, tpl) {
    const steps = (tpl.steps || []).filter(Boolean);
    if (!steps.length) return toast('That template has no steps.');
    try {
      check(await sb.from('project_checklist').insert(steps.map((label, i) => ({ project_id: r.id, label, sort: (i + 1) * 10 }))));
      await log('project', 'added the ' + tpl.name + ' checklist to', r.title, { projectId: r.id });
      reload();
    } catch (err) { fail(err); }
  }

  // A project's Social post for Buffer (project_publish). The Publish to Buffer automation sends it.
  async function savePublish(r, patch) {
    setD((d) => ({ ...d, publish: { ...(d.publish || {}), [r.id]: { ...((d.publish || {})[r.id] || { caption: '', buffer_channel_ids: [], schedule: 'queue', post_time: '09:00', youtube_title: '' }), ...patch, project_id: r.id } } }));
    try { check(await sb.from('project_publish').upsert({ project_id: r.id, ...patch }, { onConflict: 'project_id' })); } catch (err) { fail(err); }
  }
  // Lets a channel that already got this project's post be posted again the next time the workflow runs.
  async function clearPublication(r, row) {
    try {
      check(await sb.from('buffer_publications').update({ status: 'cleared' }).eq('id', row.id));
      await log('project', 'allowed a new Buffer post to ' + (row.channelLabel || row.service) + ' on', r.title, { projectId: r.id });
      reload();
    } catch (err) { fail(err); }
  }

  // Content cards added by hand (content_entries). The row is saved first, so a new card has an id for its banner
  // folder (content-covers/<workspace>/<card>/); then the new image uploads and the old one is removed.
  // cover: { file } to set a new image, { remove: true } to drop the current one, or nothing to keep it.
  async function saveContentEntry(id, row, cover = {}, oldPath = null) {
    const res = id ? check(await sb.from('content_entries').update(row).eq('id', id).select('id').single())
      : check(await sb.from('content_entries').insert({ workspace_id: ws(), ...row }).select('id').single());
    const eid = res.id;
    if (cover.file) {
      const f = cover.file;
      if (!/^image\//.test(f.type || '')) throw new Error('Banners must be an image file.');
      if (f.size > COVER_MAX) throw new Error('Banners can be up to 10 MB.');
      const ext = (f.name.match(/\.([A-Za-z0-9]+)$/) || [, 'jpg'])[1].toLowerCase();
      const path = ws() + '/' + eid + '/cover-' + Date.now() + '.' + ext;
      const up = await sb.storage.from('content-covers').upload(path, f, { upsert: false, contentType: f.type || undefined });
      if (up.error) throw new Error('The card saved, but the banner image did not upload: ' + up.error.message);
      check(await sb.from('content_entries').update({ cover_path: path }).eq('id', eid));
    } else if (cover.remove && oldPath) {
      check(await sb.from('content_entries').update({ cover_path: null }).eq('id', eid));
    }
    if (oldPath && (cover.file || cover.remove)) await sb.storage.from('content-covers').remove([oldPath]);
    await log('project', id ? 'updated the content card' : 'added the content card', row.title, { projectId: row.project_id || null });
    await reload();
    return eid;
  }
  async function deleteContentEntry(id, title, coverPath) {
    check(await sb.from('content_entries').delete().eq('id', id));
    if (coverPath) await sb.storage.from('content-covers').remove([coverPath]);
    await log('deletion', 'deleted the content card', title);
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
      await log('admin', text, patch.name || raw.name);
      return true;
    } catch (err) { fail(err); return false; }
  }
  // Test run: the server describes what each action would do on the newest project, and saves it as a test run.
  async function testAutomation(id) {
    const out = await postJson('/api/automations/' + id + '/test', {});
    const steps = ((out.run || {}).output || {}).steps || [];
    toast(steps.length ? 'Test run: ' + steps.map((x) => (x.ok ? '' : 'Failed: ') + x.detail).join(' ') : 'Test run finished. ' + ((out.run || {}).error || ''));
    await reload();
    return out.run;
  }
  async function retryRun(run) {
    try {
      await postJson('/api/automations/runs/' + run.id + '/retry', {});
      toast('Retried the run.');
    } catch (err) { toast(err.message); }
    await reload();
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
  // Status options from the board (step 4). Built-in statuses keep their name and group and cannot be deleted; the
  // database enforces that too (supabase/migrations/20261023000900_status_options.sql).
  const patchStatus = (id, patch) => setD((d) => ({ ...d, statuses: d.statuses.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  async function saveStatus(st, patch, note) {
    const prevLabel = st.label;
    patchStatus(st.id, patch);
    // Projects on this status follow a new name or group (their board group comes from the status's stage).
    if ((patch.label && patch.label !== prevLabel) || patch.stage) {
      setD((d) => ({ ...d, rows: d.rows.map((r) => (r.statusId === st.id ? { ...r, status: patch.label || r.status, g: patch.stage ? STAGE_ID[patch.stage] || r.g : r.g } : r)) }));
    }
    try {
      check(await sb.from('project_statuses').update(patch).eq('id', st.id));
      if (note) await log('admin', note, patch.label || prevLabel);
    } catch (err) { fail(err); }
  }
  // Adds a status at the end of its group and returns it at once.
  function createStatus(label, stage, tone) {
    const name = (label || '').trim();
    const D = getD();
    if (!name) return null;
    if (D.statuses.some((x) => x.label.toLowerCase() === name.toLowerCase())) { toast('There is already a status named ' + name + '.'); return null; }
    const inStage = D.statuses.filter((x) => x.stage === stage);
    const after = inStage.length ? inStage[inStage.length - 1].sort : Math.max(0, ...D.statuses.map((x) => x.sort));
    const st = { id: crypto.randomUUID(), workspace_id: ws(), label: name, stage, sort: after + 1, color_token: tone || 'gray', is_system: false, notify_sponsor: false, editors_can_set: false };
    setD((d) => ({ ...d, statuses: d.statuses.concat([st]).sort((a, b) => a.sort - b.sort) }));
    (async () => {
      try {
        check(await sb.from('project_statuses').insert(st));
        await log('admin', 'added the status', name);
      } catch (err) { fail(err); }
    })();
    return st;
  }
  // Saves a new order: ids in board order. Only rows whose sort changes are written.
  async function orderStatuses(ids) {
    const D = getD();
    const next = ids.map((id, i) => ({ id, sort: (i + 1) * 10 }));
    const changed = next.filter((n) => (D.statuses.find((x) => x.id === n.id) || {}).sort !== n.sort);
    setD((d) => ({ ...d, statuses: d.statuses.map((x) => { const n = next.find((y) => y.id === x.id); return n ? { ...x, sort: n.sort } : x; }).sort((a, b) => a.sort - b.sort) }));
    try {
      for (const n of changed) check(await sb.from('project_statuses').update({ sort: n.sort }).eq('id', n.id));
    } catch (err) { fail(err); }
  }
  async function setDefaultStatus(id) {
    setD((d) => ({ ...d, settings: { ...d.settings, default_status_id: id } }));
    try { check(await sb.from('workspace_settings').update({ default_status_id: id }).eq('workspace_id', ws())); } catch (err) { fail(err); }
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
  async function setFieldOnBoard(f, on) {
    setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === f.id ? { ...x, on_board: on } : x)) }));
    try {
      check(await sb.from('custom_fields').update({ on_board: on }).eq('id', f.id));
      await log('admin', (on ? 'added the column ' : 'removed the column ') + f.label + (on ? ' to' : ' from'), 'the board');
      toast(on ? f.label + ' is on the board.' : f.label + ' is off the board. Its values are kept.');
    } catch (err) { fail(err); }
  }
  async function setFieldRoles(f, uiRoles) {
    const roles = Array.from(new Set(['super_admin'].concat(...uiRoles.map((r) => DB_ROLES[r] || []))));
    setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === f.id ? { ...x, visible_roles: roles } : x)) }));
    try { check(await sb.from('custom_fields').update({ visible_roles: roles }).eq('id', f.id)); } catch (err) { fail(err); }
  }
  // Resolves to the new field's id (null on failure) so the board can point at the new column.
  // Kinds that store as another type keep which kind they are in config.kind (Email and Phone are text, and so on).
  // Created time and Last edited by are system columns: read-only, filled from projects.created_at and project_last_edit.
  const FIELD_KIND = { Email: 'email', Phone: 'phone', Relation: 'relation', Formula: 'formula', 'Created time': 'created_time', 'Last edited by': 'last_edited_by' };
  // Add a column step 2 can pass the options, settings and Visible to roles it collected before the column exists.
  async function addField({ label, type, onBoard, options, config, roles }) {
    try {
      const id = crypto.randomUUID();
      const visible = Array.from(new Set(['super_admin'].concat(...(roles || []).map((r) => DB_ROLES[r] || []))));
      const cfg = { ...(config || {}), ...(FIELD_KIND[type] ? { kind: FIELD_KIND[type] } : {}) };
      check(await sb.from('custom_fields').insert({ id, workspace_id: ws(), label, type: FIELD_TYPE_V[type] || 'text', on_board: !!onBoard, visible_roles: visible, editable_roles: ['super_admin'], sort: 100, config: cfg, ...(options && options.length ? { options } : {}) }));
      await log('admin', onBoard ? 'added the board column' : 'added the custom field', label);
      await reload();
      if (onBoard) toast('Added the ' + label + ' column.');
      return id;
    } catch (err) { fail(err); return null; }
  }
  // Header menu schema actions (Super Admin). Type changes, duplicates and deletes run as database functions so the
  // values convert or copy in the same transaction (supabase/migrations/20261023000600_field_schema_actions.sql).
  async function renameField(f, label) {
    const next = (label || '').trim();
    const prev = f.label;
    if (!next || next === prev) return;
    setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === f.id ? { ...x, label: next } : x)) }));
    try {
      check(await sb.from('custom_fields').update({ label: next }).eq('id', f.id));
      await log('admin', 'renamed the column ' + prev + ' to', next);
    } catch (err) { fail(err); }
  }
  async function changeFieldType(f, type) {
    const t = FIELD_TYPE_V[type] || 'text';
    if (t === f.type) return;
    setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === f.id ? { ...x, type: t } : x)) }));
    try {
      check(await sb.rpc('change_field_type', { p_field: f.id, p_type: t }));
      // A new type ends the old kind (an Email column changed to Number is a plain Number).
      if ((f.config || {}).kind) {
        const rest = { ...f.config };
        delete rest.kind;
        check(await sb.from('custom_fields').update({ config: rest }).eq('id', f.id));
      }
      await log('admin', 'changed the column type to ' + type + ' for', f.label);
      await reload();
    } catch (err) { fail(err); }
  }
  async function duplicateField(f) {
    try {
      const id = check(await sb.rpc('duplicate_field', { p_field: f.id }));
      await log('admin', 'duplicated the column', f.label);
      await reload();
      return id;
    } catch (err) { fail(err); return null; }
  }
  // Deletes right away; the toast's Undo puts the column and its values back from the snapshot.
  async function deleteField(f) {
    setD((d) => ({ ...d, customFields: d.customFields.filter((x) => x.id !== f.id) }));
    try {
      const snap = check(await sb.rpc('delete_field', { p_field: f.id }));
      await log('deletion', 'deleted the column', f.label);
      toast('Deleted the ' + f.label + ' column.', { label: 'Undo', run: () => restoreField(snap, f.label) });
      reload();
    } catch (err) { fail(err); }
  }
  async function restoreField(snap, label) {
    try {
      check(await sb.rpc('restore_field', { p_snapshot: snap }));
      await log('admin', 'restored the column', label);
      await reload();
      toast('Restored the ' + label + ' column.');
    } catch (err) { fail(err); }
  }
  // Select and Multi select (step 3). Values store option labels, so renaming, deleting or merging an option also
  // rewrites values; those run as database functions (supabase/migrations/20261023000800_select_options.sql).
  // Creating, recoloring, reordering and the sort mode only write custom_fields.options and config.
  const patchField = (id, patch) => setD((d) => ({ ...d, customFields: d.customFields.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const fieldNow = (f) => getD().customFields.find((x) => x.id === f.id) || f;
  const optsOf = (f) => (Array.isArray(fieldNow(f).options) ? fieldNow(f).options : []);
  const shown = (raw) => (raw == null ? '' : Array.isArray(raw) ? raw.join(', ') : String(raw));
  // Rewrites one field's stored values on every row in view, for the optimistic part of an option change.
  const remapValues = (f, fn) => setD((d) => ({ ...d, rows: d.rows.map((r) => {
    const cur = (r.cf || {})[f.id];
    if (cur == null) return r;
    const next = fn(cur);
    const empty = next == null || next === '' || (Array.isArray(next) && !next.length);
    return { ...r, [f.id]: empty ? '' : shown(next), cf: { ...r.cf, [f.id]: empty ? null : next } };
  }) }));
  async function saveOptions(f, options, note) {
    patchField(f.id, { options });
    try {
      check(await sb.from('custom_fields').update({ options }).eq('id', f.id));
      if (note) await log('admin', note, f.label);
    } catch (err) { fail(err); }
  }
  async function setFieldConfig(f, patch) {
    const config = { ...(fieldNow(f).config || {}), ...patch };
    patchField(f.id, { config });
    try { check(await sb.from('custom_fields').update({ config }).eq('id', f.id)); } catch (err) { fail(err); }
  }
  // Adds an option at the end and returns it right away, so a picker can select it in the same step.
  function createOption(f, label, tone) {
    const name = (label || '').trim();
    if (!name) return null;
    const list = optsOf(f);
    const dup = list.find((o) => o.label.toLowerCase() === name.toLowerCase());
    if (dup) return dup;
    const o = { id: crypto.randomUUID(), label: name, color_token: tone || 'gray', sort: (list.length + 1) * 100 };
    saveOptions(f, list.concat([o]), 'added the option ' + name + ' to');
    return o;
  }
  async function optionRpc(fn, args, note, f) {
    try {
      check(await sb.rpc(fn, args));
      await log('admin', note, f.label);
      await reload();
    } catch (err) { fail(err); }
  }
  function renameOption(f, id, label) {
    const name = (label || '').trim();
    const o = optsOf(f).find((x) => x.id === id);
    if (!o || !name || name === o.label) return;
    if (optsOf(f).some((x) => x.id !== id && x.label.toLowerCase() === name.toLowerCase())) { toast('There is already an option named ' + name + '.'); return; }
    patchField(f.id, { options: optsOf(f).map((x) => (x.id === id ? { ...x, label: name } : x)) });
    remapValues(f, (v) => (Array.isArray(v) ? v.map((x) => (x === o.label ? name : x)) : v === o.label ? name : v));
    optionRpc('rename_field_option', { p_field: f.id, p_option: id, p_label: name }, 'renamed the option ' + o.label + ' to ' + name + ' in', f);
  }
  function deleteOption(f, id) {
    const o = optsOf(f).find((x) => x.id === id);
    if (!o) return;
    patchField(f.id, { options: optsOf(f).filter((x) => x.id !== id) });
    remapValues(f, (v) => (Array.isArray(v) ? v.filter((x) => x !== o.label) : v === o.label ? null : v));
    optionRpc('delete_field_option', { p_field: f.id, p_option: id }, 'deleted the option ' + o.label + ' from', f);
  }
  function mergeOption(f, id, intoId) {
    const o = optsOf(f).find((x) => x.id === id), into = optsOf(f).find((x) => x.id === intoId);
    if (!o || !into || id === intoId) return;
    patchField(f.id, { options: optsOf(f).filter((x) => x.id !== id) });
    remapValues(f, (v) => (Array.isArray(v) ? Array.from(new Set(v.map((x) => (x === o.label ? into.label : x)))) : v === o.label ? into.label : v));
    optionRpc('merge_field_option', { p_field: f.id, p_option: id, p_into: intoId }, 'merged the option ' + o.label + ' into ' + into.label + ' in', f);
  }
  // Files & media columns: each upload is also a project file (project_assets, kind other), so it shows in the
  // drawer's Files tab. The column's value lists them: { asset_id, name, size, mime, path } or { url, name } for links.
  async function uploadFieldFiles(r, f, files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    toast('Uploading ' + (list.length === 1 ? list[0].name : fileCount(list.length)) + '…');
    const added = [];
    try {
      for (const file of list) {
        const path = await putFile(r, 'fields/' + f.id, file);
        const row = check(await sb.from('project_assets').insert({ project_id: r.id, kind: 'other', name: file.name, storage_path: path, version: 1, uploaded_by: me().id, mime_type: file.type || null, size_bytes: file.size }).select('id').single());
        added.push({ asset_id: row.id, name: file.name, size: file.size, mime: file.type || '', path });
      }
      const cur = (getD().rows.find((x) => x.id === r.id) || r).cf || {};
      await setCustomValue(r, f, (Array.isArray(cur[f.id]) ? cur[f.id] : []).concat(added));
      toast('Uploaded ' + (list.length === 1 ? list[0].name : fileCount(added.length)) + '.');
      reload();
    } catch (err) { fail(err); }
  }
  async function removeFieldFile(r, f, item) {
    const cur = (getD().rows.find((x) => x.id === r.id) || r).cf || {};
    const next = (Array.isArray(cur[f.id]) ? cur[f.id] : []).filter((x) => (item.asset_id ? x.asset_id !== item.asset_id : x.url !== item.url));
    await setCustomValue(r, f, next);
    if (!item.asset_id) return;
    try {
      check(await sb.from('project_assets').delete().eq('id', item.asset_id));
      if (item.path) { const rm = await sb.storage.from('project-assets').remove([item.path]); if (rm.error) console.warn('remove file', rm.error.message); }
      reload();
    } catch (err) { fail(err); }
  }
  function openFieldFile(r, item) {
    if (item.url) return window.open(item.url, '_blank', 'noopener');
    return openAsset({ storage_path: item.path }, r);
  }

  // Sets a custom field's value on a project. Writes to one cell run in order, so quick multi select clicks land.
  const valueChains = {};
  function setCustomValue(r, f, raw) {
    const empty = raw == null || raw === '' || (Array.isArray(raw) && !raw.length);
    const val = empty ? null : raw;
    setD((d) => ({ ...d, rows: d.rows.map((x) => (x.id === r.id ? { ...x, [f.id]: shown(val), cf: { ...(x.cf || {}), [f.id]: val } } : x)) }));
    const k = r.id + ':' + f.id;
    valueChains[k] = (valueChains[k] || Promise.resolve()).then(async () => {
      try {
        check(await sb.from('project_field_values').upsert({ project_id: r.id, field_id: f.id, value: val }, { onConflict: 'project_id,field_id' }));
        await log('project', empty ? 'cleared ' + f.label + ' on' : 'set ' + f.label + ' to ' + shown(val) + ' on', r.title, { projectId: r.id });
        // Like setField: a reload already in flight may have read the old value, so read again once this lands.
        reload();
      } catch (err) { fail(err); }
    });
    return valueChains[k];
  }
  // Each member's own board view, per board role and view kind. Debounced per view so a drag makes one write.
  const viewTimers = {};
  function saveView(boardRole, view, state) {
    const k = boardRole + ':' + view;
    clearTimeout(viewTimers[k]);
    viewTimers[k] = setTimeout(async () => {
      const res = await sb.from('board_view_state').upsert({ workspace_id: ws(), user_id: me().id, board_role: boardRole, view, state },
        { onConflict: 'workspace_id,user_id,board_role,view' });
      if (res.error) {
        console.warn('board_view_state', res.error.message);
        toast('Your board layout did not save: ' + res.error.message + '.', { label: 'Retry', run: () => saveView(boardRole, view, state) });
      }
    }, 500);
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
      return !!data.emailSent;
    } catch (err) { fail(err); return false; }
  }
  // Clients & Sponsors > Resend portal invite: the account's contact gets a real invitation for that account (a new
  // one, or the pending one sent again), through the same routes as Users > Add user.
  async function invitePortalContact(acct) {
    const email = String(acct.contact_email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Add a contact email to ' + acct.name + ' first.'); return false; }
    const pending = (getD().invitations || []).find((x) => x.account_id === acct.id && String(x.email).toLowerCase() === email);
    if (pending) return resendInvite(pending);
    const role = acct.type === 'client' ? 'client' : 'sponsor';
    const cfg = (getD().roleConfigs || []).find((rc) => rc.role === role) || {};
    try {
      await inviteMember({ email, name: acct.name, role, views: (cfg.views && cfg.views.length ? cfg.views : ['table']), accountId: acct.id, roleLabel: role === 'client' ? 'Client' : 'Sponsor' });
      return true;
    } catch (err) { toast(err.message); return false; }
  }
  // Shareable link for when email is not an option. The clipboard write happens before any await so Safari keeps
  // the click's permission; the expiry is renewed afterwards so a copied link is good for another 14 days.
  async function copyInviteLink(raw) {
    const link = window.location.origin + '/auth/invite/' + raw.token_hash;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied. Send it to ' + raw.email + '. They sign up with that email.');
    } catch {
      window.prompt('Copy this invite link for ' + raw.email + ':', link);
    }
    try {
      check(await sb.from('invitations').update({ expires_at: new Date(Date.now() + 14 * 86400000).toISOString() }).eq('id', raw.id));
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
  // Edit access: the user type (Super Admin, Editor, Designer; or Sponsor, Client) and board views. The database's
  // protect_super_admin trigger still keeps the owner and the last Super Admin in place.
  async function updateMember(raw, patch, name) {
    check(await sb.from('workspace_members').update({ role: patch.role, views: patch.views }).eq('workspace_id', raw.workspace_id).eq('user_id', raw.user_id));
    await log('access', 'changed access for', name + (patch.role !== raw.role ? ' to ' + patch.role.replace('_', ' ') : ''));
    toast('Saved access for ' + name + '. It applies the next time they load the board.');
    await reload();
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
      : mailNote(data, 'Invite emailed to ' + email + '.', 'Invite saved. Use Copy link on their row to share it.'));
    await reload();
  }

  // Copies text and says so only once the clipboard took it; otherwise shows the text to copy by hand.
  async function copyText(text, done) {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      toast(done || 'Copied.');
      return true;
    } catch {
      window.prompt('Copy this:', text);
      return false;
    }
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
  async function downloadAsset(a) {
    try {
      if (!a.storage_path) return a.external_url ? window.open(a.external_url, '_blank', 'noopener') : toast('No file is attached yet.');
      const res = await sb.storage.from('project-assets').createSignedUrl(a.storage_path, 3600, { download: a.name });
      if (res.error) throw res.error;
      window.location.assign(res.data.signedUrl);
    } catch (err) { toast(err.message); }
  }
  async function removeAsset(a, r) {
    setD((d) => ({ ...d, assets: { ...d.assets, [r.id]: (d.assets[r.id] || []).filter((x) => x.id !== a.id) } }));
    try {
      check(await sb.from('project_assets').delete().eq('id', a.id));
      if (a.storage_path) {
        const rm = await sb.storage.from('project-assets').remove([a.storage_path]);
        if (rm.error) console.warn('remove file', rm.error.message);
      }
      await log('project', 'removed ' + a.name + ' from', r.title, { projectId: r.id });
      toast('Removed ' + a.name + '.');
      reload();
    } catch (err) { fail(err); }
  }
  function pickFiles(accept, multiple, then) {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.multiple = !!multiple;
    input.onchange = () => { const files = Array.from(input.files || []); if (files.length) then(files); };
    input.click();
  }
  function pickAndUpload(r, kind, accept) {
    pickFiles(accept, kind !== 'draft', (files) => uploadFiles(r, kind, files));
  }
  // Drafts get the next version number each; thumbnails and other files keep version 1.
  async function uploadFiles(r, kind, files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const base = kind === 'draft' ? (getD().assets[r.id] || []).filter((a) => a.kind === 'draft').reduce((m, a) => Math.max(m, a.version || 1), 0) : 0;
    toast('Uploading ' + (list.length === 1 ? list[0].name : fileCount(list.length)) + '…');
    let done = 0;
    try {
      for (const file of list) {
        const version = kind === 'draft' ? base + done + 1 : 1;
        const path = await putFile(r, kind, file, version);
        const name = kind === 'draft' ? 'Edit v' + version : kind === 'thumbnail' ? (r.thumb === 'Done' ? 'Thumbnail final' : 'Thumbnail concepts') : file.name;
        check(await sb.from('project_assets').insert({ project_id: r.id, kind, name, storage_path: path, version, uploaded_by: me().id, mime_type: file.type || null, size_bytes: file.size }));
        if (kind === 'draft' && r.editorId === me().id || (kind === 'draft' && me().uiRole === 'admin' && (r.editorId || r.editStatus))) {
          await sb.from('project_edits').update({ draft_version: version }).eq('project_id', r.id);
        }
        await log('project', kind === 'draft' ? 'uploaded draft v' + version + ' for' : 'uploaded ' + name + ' for', r.title, { projectId: r.id, event: 'status' });
        done++;
      }
      toast('Uploaded ' + (list.length === 1 ? list[0].name : fileCount(done)) + '.');
      reload();
    } catch (err) { fail(err); }
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
  // A brand image as a File, so New idea can use it as a cover (covers live in their own bucket).
  async function brandFileAsFile(a) {
    const res = await sb.storage.from('brand-assets').download(a.path);
    if (res.error) throw res.error;
    return new File([res.data], a.name || a.path.split('/').pop(), { type: res.data.type || 'image/jpeg' });
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
    // Default values from Add a column step 2 (custom_fields.config.default_value). The project stands without them.
    // Only fields the creator may edit (custom_fields.editable_roles, as the fv_insert policy checks).
    const defaults = D.customFields.filter((f) => f.config && f.config.default_value != null && f.config.default_value !== '' && !(Array.isArray(f.config.default_value) && !f.config.default_value.length)
      && (f.editable_roles || []).indexOf(me().dbRole) >= 0);
    if (defaults.length) {
      const res = await sb.from('project_field_values').insert(defaults.map((f) => ({ project_id: p.id, field_id: f.id, value: f.config.default_value })));
      if (res.error) console.warn('default values', res.error.message);
    }
    // The template's steps become this project's checklist (drawer Overview).
    const steps = template ? (template.steps || []).filter(Boolean) : [];
    if (steps.length) {
      const res = await sb.from('project_checklist').insert(steps.map((label, i) => ({ project_id: p.id, label, sort: (i + 1) * 10 })));
      if (res.error) toast('The project was created, but its checklist was not: ' + res.error.message);
    }
    await log('project', 'created the project', title, { projectId: p.id });
    if (template && (template.default_editor_id || template.default_designer_id)) sendEmails();
    await reload();
    return p.id;
  }

  return {
    toast, log: (cat, text, target) => log(cat, text, target).then(reload), reload, switchAccount, sendEmails,
    setField, applyPatch, postComment, decide, toggleTask, addTask, markRead, sendChat, askAssistant, markProposalDone,
    updateIdea, deleteIdea, commentIdea, createIdea, setIdeaCover, promoteIdea, startResearch, cancelResearch,
    saveProfileName, changeEmail, savePrefs, resetPassword, signOut,
    savePermissions, setRoleViews, setRoleColumns, saveRoleView, patchRoleView, saveColumnPresets, setColumnConfig, updateSettings, updateAccount, removeAccount, addAccount, setFinStatus,
    updateAutomation, deleteAutomation, createAutomation, archiveProject, deleteProject, saveIntegration, listModels, disconnectIntegration, syncIntegration, exportCsv, saveWorkspace,
    removeStatus, addStatus, saveStatus, createStatus, orderStatuses, setDefaultStatus, addChannel, removeField, setFieldRoles, addField, renameField, changeFieldType, duplicateField, deleteField, saveView,
    saveOptions, setFieldConfig, createOption, uploadFieldFiles, removeFieldFile, openFieldFile, renameOption, deleteOption, mergeOption, setCustomValue, resendInvite, copyInviteLink, setMemberStatus, setMemberRole, removeMember, inviteMember,
    openAsset, downloadAsset, removeAsset, pickFiles, pickAndUpload, uploadFiles, createProject,
    createBrand, updateBrand, deleteBrand, uploadBrandFile, openBrandFile, removeBrandFile, brandFileAsFile,
    markInboxRead, loadOlderActivity, editComment, deleteComment, updateMember, invitePortalContact, copyText, testAutomation, retryRun, saveFinRecord, saveBudget, deleteFinRecord, sendInvoice,
    saveTemplate, deleteTemplate, toggleCheck, addCheck, removeCheck, applyTemplate, setFieldOnBoard, enrollMfa, verifyMfa, disableMfa,
    savePublish, clearPublication, saveContentEntry, deleteContentEntry, markSeen,
  };
}
