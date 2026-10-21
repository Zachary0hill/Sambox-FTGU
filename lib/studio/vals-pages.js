// Workspace pages: Daily, Inbox, Content, Brand, Settings. Ported from the design's pagesVals().
import { relTime, dayGroup, fmtCount, MONTHS, startOfDay, first } from './model';

// The browser's speech recognizer while the assistant is dictating; one at a time across both composers.
let dictation = null;

export function pagesVals(c) {
  const s = c.s, set = c.set, dark = c.dark, TONE = c.TONE, DARKFILL = c.DARKFILL, toolStyle = c.toolStyle, actColor = c.actColor;
  const TYPEFILL = c.TYPEFILL, fillFor = c.fillFor, dueState = c.dueState, di = c.di, TODAY = c.TODAY, scoped = c.scoped, allRows = c.allRows;
  const ROLES = c.ROLES, page = c.page, role = s.role, isSponsor = role === 'sponsor';
  const D = c.D, A = c.A, me = c.me, now = c.now, acctName = c.acctName;
  const solid = (tn) => dark ? DARKFILL[tn] : [TONE[tn][3], '#FFFFFF'];
  const hardBlock = (f, h) => 'display: inline-flex; align-items: center; height: ' + (h || 26) + 'px; padding: 0 10px; border-radius: 0; font-size: 12px; font-weight: 600; white-space: nowrap; background: ' + (f ? f[0] : 'var(--chip)') + '; color: ' + (f ? f[1] : 'var(--ink-3)') + ';';
  const sw = (on) => ({
    on: on ? 'true' : 'false',
    track: 'position: relative; display: block; width: 40px; height: 24px; border-radius: 999px; background: ' + (on ? 'var(--inv)' : 'var(--border-strong)') + '; transition: background .15s ease;',
    knob: 'position: absolute; top: 3px; left: ' + (on ? '19px' : '3px') + '; width: 18px; height: 18px; border-radius: 999px; background: ' + (on ? 'var(--inv-ink)' : 'var(--surface)') + '; transition: left .15s ease;'
  });
  const GRAYP = 'display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;';
  const tab = (label, count, on, pick) => ({ label: label, count: String(count), badge: GRAYP, pressed: on ? 'true' : 'false', pick: pick, style: toolStyle(on), swatch: 'display: none;' });
  const rowById = {};
  allRows.forEach((r) => { rowById[r.id] = r; });
  const openProj = (job, dTab) => () => set({ nav: 'projects', openJob: job, dTab: dTab || 'overview', draft: '', menu: '' });
  const scopedId = {};
  scoped.forEach((r) => { scopedId[r.id] = true; });
  const seg2 = (on) => 'min-height: 36px; padding: 0 14px; border: 0; border-radius: 10px; cursor: pointer; font-size: 13px; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);');
  const whoOf = (id, label) => (id && id === me.id ? 'You' : (label || 'Team'));

  // ---------- Daily assistant ----------
  const firstName = isSponsor ? acctName : me.name;
  const lateRows = scoped.filter((r) => dueState('editDue', r) === 'late' || dueState('thumbDue', r) === 'late');
  const pend = scoped.filter((r) => r.approval === 'Pending' && (!isSponsor || r.sponsor === acctName));
  const stageN = (id) => scoped.filter((r) => r.g === id).length;
  const within = (t) => { const n = di(t); return n !== null && n >= TODAY && n <= TODAY + 7; };
  const rowBtn = 'display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 14px 8px 16px; box-sizing: border-box; border: 0; border-bottom: 1px solid var(--line); background: transparent; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.3;';
  const item = (r, meta, tag, f) => ({ title: r.title, meta: meta, tag: tag, tagStyle: hardBlock(f, 24) + ' flex: none;', open: openProj(r.job), aria: 'Open ' + r.title, rowStyle: rowBtn });
  const statusItem = (r, meta) => item(r, meta, r.status, fillFor('status', r.status));
  const upcoming = [];
  scoped.forEach((r) => [['editDue', 'Edit due'], ['thumbDue', 'Thumbnail due'], ['pub', 'Publishes']].forEach((p) => { const n = di(r[p[0]]); if (n !== null && n >= TODAY && !(p[0] === 'editDue' && r.editStatus === 'Approved') && !(p[0] === 'thumbDue' && r.thumb === 'Done')) upcoming.push({ n: n, text: p[1] + ' ' + r[p[0]] + ' on ' + r.title }); }));
  upcoming.sort((a, b) => a.n - b.n);
  const nextDue = upcoming.length ? 'Next up: ' + upcoming[0].text + '.' : 'Nothing is scheduled ahead.';
  const summary = scoped.length + ' projects in your view: ' + stageN('prod') + ' in production, ' + stageN('post') + ' in post production and ' + stageN('pub') + ' publishing.';
  const wk = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const weekText = MONTHS[now.getMonth()] + ' ' + now.getDate() + ' and ' + MONTHS[wk.getMonth()] + ' ' + wk.getDate();
  const replyFor = (q) => {
    const t = String(q).toLowerCase();
    if (/late|overdue|behind|past due/.test(t)) {
      if (!lateRows.length) return { text: 'Nothing is past due in your view. ' + nextDue, items: [] };
      return {
        text: lateRows.length + (lateRows.length === 1 ? ' deadline is' : ' deadlines are') + ' past due. Start with these:',
        items: lateRows.map((r) => { const k = dueState('editDue', r) === 'late' ? 'editDue' : 'thumbDue'; return item(r, (k === 'editDue' ? 'Edit due ' : 'Thumbnail due ') + r[k] + '  ·  ' + (k === 'editDue' ? r.editor : r.designer), 'Late', solid('red')); }),
        foot: 'Open one to reassign it or move the deadline.'
      };
    }
    if (/sponsor|approv/.test(t)) {
      return {
        text: pend.length ? pend.length + (pend.length === 1 ? ' sponsor approval is' : ' sponsor approvals are') + ' open.' : 'No sponsor approvals are open in your view.',
        items: pend.map((r) => item(r, 'Sponsor ' + r.sponsor + '  ·  Pub ' + r.pub, r.status, fillFor('status', r.status))),
        foot: isSponsor ? 'Open a project to approve it or request changes.' : 'A project can move to Scheduled once its sponsor approves.'
      };
    }
    if (/week|plan|today|due|schedule|calendar/.test(t)) {
      const rs = scoped.filter((r) => within(r.film) || within(r.editDue) || within(r.thumbDue) || within(r.pub));
      return {
        text: rs.length ? 'Here is what lands between ' + weekText + '.' : 'Nothing lands in the next 7 days. ' + nextDue,
        items: rs.map((r) => statusItem(r, [['film', 'Film'], ['editDue', 'Edit'], ['thumbDue', 'Thumb'], ['pub', 'Pub']].filter((p) => within(r[p[0]])).map((p) => p[1] + ' ' + r[p[0]]).join('  ·  '))),
        bullets: lateRows.length ? ['Clear the ' + lateRows.length + ' late deadline' + (lateRows.length === 1 ? '' : 's') + ' first so this week stays on track.'] : [],
        foot: 'Ask for a day by day plan to break this down further.'
      };
    }
    if (/script|caption|hook|outline/.test(t)) {
      const nx = scoped.find((r) => r.status === 'Scripting') || scoped.find((r) => r.status === 'Filming');
      if (!nx) return { text: 'No project is in Scripting or Filming in your view.', items: [] };
      return {
        text: 'Next up to script: ' + nx.title + '.',
        items: [statusItem(nx, [['Film', nx.film], ['Pub', nx.pub], ['Sponsor', nx.sponsor]].filter((p) => p[1]).map((p) => p[0] + ' ' + p[1]).join('  ·  '))],
        foot: 'Open the project to write the script and caption.'
      };
    }
    if (/strateg|idea|content|mix/.test(t)) {
      const ty = {};
      scoped.forEach((r) => { ty[r.type] = (ty[r.type] || 0) + 1; });
      const needClips = allRows.filter((r) => r.status === 'Live' && r.clipping && r.clipping !== 'Done').length;
      return {
        text: scoped.length ? 'Here is the content mix on the board.' : 'There are no projects on the board yet.',
        items: [],
        bullets: scoped.length ? D.types.map((x) => x.label + ': ' + (ty[x.label] || 0) + ' in the pipeline.').concat([
          'Distribution: ' + needClips + ' live video' + (needClips === 1 ? '' : 's') + ' still need clipping.',
          'Sponsors: ' + pend.length + ' approval' + (pend.length === 1 ? '' : 's') + ' open.'
        ]) : []
      };
    }
    const post = scoped.filter((r) => r.g === 'post');
    return {
      text: (/update|status|summary|project/.test(t) ? '' : 'Here is a quick read on the board. ') + summary,
      items: post.map((r) => statusItem(r, [r.editor ? 'Editor ' + r.editor : '', r.editStatus].filter(Boolean).join('  ·  ') || 'Pub ' + r.pub)),
      bullets: [lateRows.length + ' past due deadline' + (lateRows.length === 1 ? '' : 's') + '.', pend.length + ' sponsor approval' + (pend.length === 1 ? '' : 's') + ' open.', nextDue],
      foot: post.length ? 'Those are the projects in post production right now.' : ''
    };
  };

  // app: with an AI model connected, replies come from /api/assistant (stored in ai_messages and streamed while
  // they generate). replyFor() answers when no model is connected, and for older chats saved before AI replies.
  const AI = D.assistant && D.assistant.enabled && !s.aiOff ? D.assistant : null;
  const TOOL_LABEL = { search_projects: 'Searching projects', get_project: 'Reading the project', list_ideas: 'Reading ideas', plan_week: 'Checking the week ahead', create_project: 'Creating the project', add_idea: 'Saving the idea', web_search: 'Searching the web', scrape_url: 'Reading the page' };
  const chats = {};
  const pendingChats = s.chatsLocal || {};
  D.threads.forEach((t) => { chats[t.id] = { id: t.id, title: t.title, group: { today: 'Today', yesterday: 'Yesterday', earlier: 'Older' }[dayGroup(t.at, now)], msgs: (t.msgs || t.q.map((q) => ({ role: 'user', body: q }))).slice() }; });
  // A local entry wins while it is generating, holds an error, or is ahead of what the last load returned.
  Object.keys(pendingChats).forEach((id) => {
    const loc = pendingChats[id], cur = chats[id];
    if (!cur || loc.pending || loc.msgs.length > cur.msgs.length || (loc.error && loc.msgs.length >= cur.msgs.length)) chats[id] = Object.assign({}, cur || {}, loc);
  });
  const order = Object.keys(pendingChats).filter((id) => !D.threads.some((t) => t.id === id)).concat(D.threads.map((t) => t.id));
  const cq = (s.chatQ || '').trim().toLowerCase();
  const curId = s.chatId && chats[s.chatId] ? s.chatId : '';
  const inline = (t) => String(t).replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=[\s.,;:!?)]|$)/g, '$1$2').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)').trim();
  const plain = (t) => inline(String(t || '').replace(/^\s*(#{1,6}|[-*•]|\d+[.)]|>)\s+/gm, '')).replace(/\s+/g, ' ');
  const P_ST = 'margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-2); overflow-wrap: anywhere;';
  const H_ST = 'margin: 0; font-size: 15px; line-height: 1.5; font-weight: 600; color: var(--ink); overflow-wrap: anywhere;';
  const L_ST = (ord) => 'margin: 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; line-height: 1.55; color: var(--ink-2); overflow-wrap: anywhere; list-style-type: ' + (ord ? 'decimal' : 'disc') + ';';
  // Model text to paragraphs and lists, rendered as plain text nodes (no HTML from the model reaches the page).
  const toBlocks = (text) => {
    const out = [];
    let para = [], list = null;
    const endPara = () => { if (para.length) out.push({ isP: true, isList: false, text: inline(para.join(' ')), items: [], style: P_ST }); para = []; };
    const endList = () => { if (list) out.push(list); list = null; };
    const addItem = (ord, txt) => { if (!list || list.ordered !== ord) { endList(); list = { isP: false, isList: true, ordered: ord, text: '', items: [], style: L_ST(ord) }; } list.items.push(txt); };
    String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      const line = raw.trim();
      if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(line)) return;
      if (!line || /^```/.test(line) || /^[-*_]{3,}$/.test(line)) { endPara(); endList(); return; }
      const b = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (b) { endPara(); addItem(/\d/.test(b[1]), inline(b[2])); return; }
      if (/^\|.*\|$/.test(line)) { endPara(); addItem(false, line.slice(1, -1).split('|').map((x) => inline(x)).filter(Boolean).join('  ·  ')); return; }
      if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1] += ' ' + inline(line); return; }
      endList();
      const h = /^#{1,6}\s+(.*)$/.exec(line);
      if (h) { endPara(); out.push({ isP: true, isList: false, text: inline(h[1]), items: [], style: H_ST }); return; }
      para.push(line.replace(/^>\s?/, ''));
    });
    endPara(); endList();
    return out;
  };
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentioned = (body) => scoped.filter((r) => r.job && r.job.length >= 3 && new RegExp('(^|[^A-Za-z0-9-])' + esc(r.job) + '(?![A-Za-z0-9])').test(body)).slice(0, 6)
    .map((r) => statusItem(r, [r.pub ? 'Pub ' + r.pub : '', r.editor ? 'Editor ' + r.editor : '', r.sponsor ? 'Sponsor ' + r.sponsor : ''].filter(Boolean).join('  ·  ') || r.channel));
  // app: assistant proposals. The assistant cannot write; each proposal is a card and the member's click runs the
  // normal client action (A.createProject / A.createIdea) on their own session.
  const isoLabel = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) : String(iso || ''); };
  const propState = s.propState || {};
  const PROP_CARD = 'display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface);';
  const propCard = (p, msgId, idx, waiting) => {
    const isProject = p.kind === 'project';
    const k = (p.kind || '') + ':' + (p.title || '') + ':' + (p.job || p.brandId || '');
    const st = p.done ? 'done' : propState[k] || '';
    const fields = (isProject
      ? [['Job #', p.job], ['Status', p.status], ['Channel', p.channel], ['Type', p.type], ['Film', isoLabel(p.film)], ['Publish', isoLabel(p.pub)], ['Sponsor', p.sponsor], ['Template', p.template]]
      : [['Brand', p.brand], ['Type', p.type || 'Idea']]).filter((f) => f[1]).map((f) => ({ label: f[0], value: String(f[1]) }));
    const lines = isProject ? [] : (Array.isArray(p.body) ? p.body : []).slice(0, 4).map((x) => { const t = String(x); return t.length > 220 ? t.slice(0, 219) + '…' : t; });
    const setSt = (v) => set((cur) => ({ propState: Object.assign({}, cur.propState || {}, { [k]: v }) }));
    const run = () => {
      if (st === 'busy' || waiting) return;
      if (st === 'done') { if (isProject) openProj(p.job)(); else set({ nav: 'ideas' }); return; }
      if (isProject && D.rows.some((r) => r.job.toLowerCase() === String(p.job || '').toLowerCase())) { A.toast('Job number ' + p.job + ' is already in use.'); return; }
      setSt('busy');
      const tpl = p.template ? D.templates.find((t) => t.name === p.template) || null : null;
      const job = isProject
        ? A.createProject({ title: p.title, job: p.job, channel: p.channel, type: p.type, status: p.status, film: p.film || null, pub: p.pub || null, sponsor: p.sponsor || '', template: tpl })
        : A.createIdea({ title: p.title, brandId: p.brandId, type: p.type || 'Idea', body: Array.isArray(p.body) ? p.body : [] });
      Promise.resolve(job).then(() => {
        setSt('done');
        A.markProposalDone(msgId, idx);
        A.toast(isProject ? 'Created ' + p.title + '.' : 'Added ' + p.title + ' to Ideas & Research.');
      }).catch((err) => { setSt(''); A.toast((err && err.message) || 'Could not save it.'); });
    };
    const label = waiting ? 'Waiting for the answer…' : st === 'busy' ? (isProject ? 'Creating…' : 'Adding…') : st === 'done' ? (isProject ? 'Open project' : 'Open Ideas & Research') : isProject ? 'Create project' : 'Add idea';
    const primary = !waiting && st !== 'done';
    return {
      kindLabel: isProject ? 'New project' : 'New ' + String(p.type || 'Idea').toLowerCase(), title: String(p.title || ''),
      fields: fields, lines: lines, hasLines: lines.length > 0,
      note: st === 'done' ? (isProject ? 'Created.' : 'Added.') : 'Nothing is saved until you click.',
      btnLabel: label, act: run, disabled: waiting || st === 'busy', cardStyle: PROP_CARD,
      btnStyle: 'align-self: flex-start; min-height: 40px; padding: 0 16px; border: 0; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: ' + (waiting || st === 'busy' ? 'default' : 'pointer') + '; background: ' + (primary ? 'var(--inv)' : 'var(--chip-2)') + '; color: ' + (primary ? 'var(--inv-ink)' : 'var(--ink-2)') + ';' + (waiting || st === 'busy' ? ' opacity: 0.6;' : '')
    };
  };
  const AI_WRAP = 'display: flex; align-items: flex-start; gap: 12px;';
  const aiMsg = (o) => {
    const items = o.items || [];
    return { isUser: false, isAi: true, text: o.text || '', hasText: !!o.text, blocks: o.blocks || [], hasBlocks: !!(o.blocks && o.blocks.length), cards: o.cards || [], hasCards: !!(o.cards && o.cards.length), items: items, hasItems: items.length > 0, bullets: [], hasBullets: false, foot: o.foot || '', hasFoot: !!o.foot, wrapStyle: AI_WRAP };
  };
  const groups = ['Today', 'Yesterday', 'Older'].map((g) => ({
    title: g,
    items: order.map((id) => chats[id]).filter((ch) => ch && ch.group === g && (!cq || ch.title.toLowerCase().includes(cq))).map((ch) => {
      const on = ch.id === curId;
      const last = ch.msgs[ch.msgs.length - 1];
      return {
        title: ch.title, current: on ? 'page' : 'false',
        preview: ch.pending ? 'Thinking…' : ch.error ? ch.error : !last ? '' : last.role === 'assistant' ? plain(last.body) : replyFor(last.body).text,
        pick: () => set({ chatId: ch.id, chatDraft: '' }),
        style: 'display: flex; align-items: flex-start; gap: 10px; width: 100%; min-height: 56px; padding: 8px 12px; box-sizing: border-box; border: 0; border-radius: 12px; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.3; color: var(--ink-4); background: ' + (on ? 'var(--chip-2)' : 'transparent') + ';'
      };
    })
  })).filter((g) => g.items.length > 0);
  // Rule-based path: store the question, answer locally with replyFor().
  const sendRule = (t, title, threadId, localKey) => {
    set((cur) => {
      const l = Object.assign({}, cur.chatsLocal || {});
      const base = chats[localKey] || l[localKey] || { id: localKey, title: title, group: 'Today', msgs: [] };
      const msgs = base.msgs.length && base.msgs[base.msgs.length - 1].role === 'user' && base.msgs[base.msgs.length - 1].body === t ? base.msgs : base.msgs.concat([{ role: 'user', body: t }]);
      l[localKey] = Object.assign({}, base, { msgs: msgs, pending: false, stream: '', tool: '', error: '' });
      return { chatsLocal: l, chatDraft: '' };
    });
    A.sendChat(threadId, threadId ? null : title, t).then((realId) => {
      if (realId && realId !== localKey) set((cur) => { const l = Object.assign({}, cur.chatsLocal || {}); delete l[localKey]; return { chatsLocal: l, chatId: cur.chatId === localKey ? realId : cur.chatId }; });
    });
  };
  const send = (txt) => {
    const t = String(txt == null ? (s.chatDraft || '') : txt).trim();
    if (!t || (curId && chats[curId].pending)) return;
    const title = t.length > 44 ? t.slice(0, 44) + '…' : t;
    const realCur = curId && curId.indexOf('local-') !== 0 ? curId : null;
    let key = curId || 'local-' + Date.now();
    if (!AI) {
      set({ chatId: key });
      sendRule(t, title, realCur, key);
      return;
    }
    const base = curId ? chats[curId] : { id: key, title: title, group: 'Today', msgs: [] };
    const entry = Object.assign({}, base, { msgs: base.msgs.concat([{ role: 'user', body: t }]), pending: true, stream: '', tool: '', error: '', proposals: [] });
    const patch = (fn) => set((cur) => { const l = Object.assign({}, cur.chatsLocal || {}); if (l[key]) l[key] = Object.assign({}, l[key], fn(l[key])); return { chatsLocal: l }; });
    set((cur) => ({ chatsLocal: Object.assign({}, cur.chatsLocal || {}, { [key]: entry }), chatId: key, chatDraft: '' }));
    A.askAssistant(realCur, title, t, (ev) => {
      if (ev.type === 'thread' && ev.id && ev.id !== key) {
        const old = key;
        key = ev.id;
        set((cur) => { const l = Object.assign({}, cur.chatsLocal || {}); l[key] = Object.assign({}, l[old], { id: key }); delete l[old]; return { chatsLocal: l, chatId: cur.chatId === old ? key : cur.chatId }; });
      } else if (ev.type === 'text') patch(() => ({ stream: ev.text }));
      else if (ev.type === 'tool') patch(() => ({ tool: ev.name }));
      else if (ev.type === 'proposal') patch(() => ({ proposals: ev.proposals }));
    }).then((r) => {
      if (r.noModel) {
        // The model was disconnected since the page loaded: answer from board data instead.
        set({ aiOff: true });
        patch((e) => ({ pending: false, msgs: e.msgs.slice(0, -1) }));
        sendRule(t, title, realCur, key);
        return;
      }
      const props = r.proposals || [];
      patch((e) => ({ pending: false, stream: '', tool: '', proposals: [], error: r.error || '', msgs: r.text.trim() || props.length ? e.msgs.concat([{ role: 'assistant', body: r.text.trim(), meta: props.length ? { proposals: props } : {} }]) : e.msgs }));
    });
  };
  const msgs = [];
  if (curId) {
    const ch = chats[curId], list = ch.msgs || [];
    list.forEach((m, i) => {
      if (m.role === 'assistant') {
        const props = (m.meta && Array.isArray(m.meta.proposals)) ? m.meta.proposals : [];
        msgs.push(aiMsg({ blocks: toBlocks(m.body), items: mentioned(m.body), cards: props.map((p, j) => propCard(p, m.id, j, false)) }));
        return;
      }
      msgs.push({ isUser: true, isAi: false, text: m.body, wrapStyle: 'display: flex; justify-content: flex-end;' });
      const nx = list[i + 1];
      if ((nx && nx.role === 'assistant') || (i === list.length - 1 && (ch.pending || ch.error))) return;
      const rp = replyFor(m.body);
      const items = rp.items || [], bullets = rp.bullets || [];
      msgs.push(Object.assign(aiMsg({ text: rp.text, items: items, foot: rp.foot || '' }), { bullets: bullets, hasBullets: bullets.length > 0 }));
    });
    if (ch.pending) {
      const label = ch.tool ? (TOOL_LABEL[ch.tool] || 'Working') + '…' : ch.stream ? 'Writing…' : 'Thinking…';
      msgs.push(aiMsg({ blocks: toBlocks(ch.stream), foot: label, cards: (ch.proposals || []).map((p, j) => propCard(p, null, j, true)) }));
    } else if (ch.error) {
      msgs.push(aiMsg({ text: ch.error, foot: 'Send the message again, or start a new chat.' }));
    }
  }

  const edits = scoped.filter((r) => r.editStatus), thumbs = scoped.filter((r) => r.thumb), apps = scoped.filter((r) => r.approval);
  const totalD = edits.length + thumbs.length + apps.length;
  const doneD = edits.filter((r) => r.editStatus === 'Approved').length + thumbs.filter((r) => r.thumb === 'Done').length + apps.filter((r) => r.approval === 'Approved').length;
  const pct = totalD ? Math.round(doneD / totalD * 100) : 0;
  const PRI = { High: 'red', Med: 'blue', Low: 'gray' };
  const pendingTasks = c.tasks.filter((t) => !t.done);
  // Audience reach from content_metrics on the projects in view.
  const metricOf = c.metricOf;
  const reachRows = c.catalogRows.concat(scoped).filter((r) => metricOf[r.id]).sort((a, b) => (di(a.pub) || 0) - (di(b.pub) || 0));
  const reachTotal = reachRows.reduce((a, r) => a + Number(metricOf[r.id].views || 0), 0);
  let accum = 0;
  const rv = reachRows.length > 1 ? reachRows.map((r) => (accum += Number(metricOf[r.id].views || 0))) : [];
  const mn = Math.min.apply(null, rv), mx = Math.max.apply(null, rv);
  const spark = rv.length < 2 ? '' : rv.map((v, i) => (i * 120 / (rv.length - 1)).toFixed(1) + ',' + (22 - (v - mn) / Math.max(1, mx - mn) * 20).toFixed(1)).join(' ');
  const reach = [fmtCount(reachTotal), rv, isSponsor ? 'Views on your projects' : 'Views across ' + reachRows.length + ' published videos'];
  const cardStyle = (i) => 'display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; box-sizing: border-box; border: 1px solid var(--line-3); border-radius: 18px; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.07); animation-delay: ' + (60 + i * 50) + 'ms;';
  const ico = (tn) => { const f = solid(tn); return 'width: 24px; height: 24px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: ' + f[0] + '; color: ' + f[1] + ';'; };
  const card = (o, i) => Object.assign({ isBar: false, isSeg: false, isChips: false, isSpark: false, segs: [], chips: [], spark: '', sparkColor: '', barStyle: '' }, o, { style: cardStyle(i) });
  const STAGE_C = { prod: '#F08A5D', post: '#E0567F', pub: '#A66BD6' };
  const tasksCard = isSponsor
    ? { label: 'Approvals', value: String(pend.length), sub: pend.length ? 'Next: ' + pend[0].title : 'Nothing waiting on you', chips: pend.map(() => ({ style: 'flex: 1; background: ' + solid('amber')[0] + ';' })) }
    : { label: 'Tasks & reminders', value: String(pendingTasks.length), sub: pendingTasks.length ? 'Next: ' + pendingTasks[0].text : 'All tasks done', chips: pendingTasks.map((t) => ({ style: 'flex: 1; background: ' + (PRI[t.pr] === 'gray' ? 'var(--border-strong)' : solid(PRI[t.pr])[0]) + ';' })) };
  if (!tasksCard.chips.length) tasksCard.chips = [{ style: 'flex: 1; background: var(--chip-2);' }];
  const kcards = [
    card({ label: 'Productivity', value: pct + '%', sub: doneD + ' of ' + totalD + ' deliverables done', icon: 'M22 12h-4l-3 9L9 3l-3 9H2', iconStyle: ico('green'), isBar: true, barStyle: 'display: block; height: 6px; width: ' + pct + '%; background: ' + solid('green')[0] + ';' }, 0),
    card({ label: 'Projects', value: String(scoped.length), sub: stageN('prod') + ' prod  ·  ' + stageN('post') + ' post  ·  ' + stageN('pub') + ' publishing', icon: 'M3 3h18v18H3zM8 7v7M12 7v4M16 7v10', iconStyle: ico('blue'), isSeg: true, segs: ['prod', 'post', 'pub'].map((g) => ({ style: 'flex: ' + (stageN(g) || 0.0001) + ' 1 0; background: ' + STAGE_C[g] + ';' + (stageN(g) ? '' : ' display: none;') })) }, 1),
    card(Object.assign({ icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', iconStyle: ico('amber'), isChips: true }, tasksCard), 2),
    card({ label: 'Audience reach', value: reach[0], sub: reach[2], icon: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', iconStyle: ico('violet'), isSpark: rv.length > 1, spark: spark, sparkColor: solid('violet')[0] }, 3)
  ];
  const Q = isSponsor
    ? [['Project update', 'Give me a project update', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', 'green'], ['My approvals', 'Which sponsor approvals are open?', 'M20 6 9 17l-5-5', 'violet'], ['Plan my week', 'Plan my week', 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18', 'amber'], ['Content mix', 'Give me the content mix', 'M3 3v18h18M7 14l4-4 4 4 5-5', 'blue']]
    : [['Project update', 'Give me a project update', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', 'green'], ['What is late?', 'What is late?', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', 'red'], ['Plan my week', 'Plan my week', 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18', 'amber'], ['Next to script', 'What is next to script?', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 'violet']];
  const quick = Q.map((q) => { const f = solid(q[3]); return { label: q[0], icon: q[2], pick: () => send(q[1]), tileStyle: 'width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: ' + f[0] + '; color: ' + f[1] + ';' }; });
  const hour = now.getHours();
  const draft = s.chatDraft || '';
  const lateJobs = {};
  lateRows.forEach((r) => { lateJobs[r.job] = true; });
  const attn = lateRows.map((r) => item(r, dueState('editDue', r) === 'late' ? 'Edit was due ' + r.editDue : 'Thumbnail was due ' + r.thumbDue, 'Late', solid('red')))
    .concat(pend.filter((r) => !lateJobs[r.job]).map((r) => item(r, 'Sponsor approval pending' + (r.sponsor ? ', ' + r.sponsor : ''), 'Pending', solid('amber'))))
    .slice(0, 5);
  const chat = {
    groups: groups, noHistory: groups.length === 0,
    onSearch: (e) => set({ chatQ: e && e.target ? e.target.value : '' }),
    newChat: () => set({ chatId: '', chatDraft: '' }),
    isEmpty: !curId, hasMsgs: !!curId, msgs: msgs,
    subtitle: curId ? chats[curId].title : 'Your studio assistant',
    greeting: (hour < 12 ? 'Good morning, ' : hour < 18 ? 'Good afternoon, ' : 'Good evening, ') + firstName + '.',
    sub: AI
      ? 'Ask about projects, deadlines, approvals or what to post next, or how to use the board. ' + AI.providerName + ' answers from the board data for your view' + (AI.web ? ' and can search the web.' : '.')
      : 'Ask about projects, deadlines, approvals or what to post next. Answers use the board data for your view.',
    cards: kcards, quick: quick, attn: attn, hasAttn: attn.length > 0,
    placeholder: 'Ask anything about your projects',
    draft: draft,
    onDraft: (e) => set({ chatDraft: e && e.target ? e.target.value : '' }),
    onKey: (e) => { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); send(e.target ? e.target.value : null); } },
    send: () => { if (dictation) dictation.stop(); send(); },
    // app: Dictate uses the browser's speech recognition and appends what it hears to the draft.
    dictating: !!s.dictating,
    dictateLabel: s.dictating ? 'Stop dictating' : 'Dictate',
    dictate: () => {
      if (dictation) { dictation.stop(); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { A.toast('Dictation is not available in this browser. Try Chrome, Edge or Safari.'); return; }
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || 'en-US';
      rec.onresult = (e) => {
        let heard = '';
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
        if (heard.trim()) set((cur) => ({ chatDraft: ((cur.chatDraft || '').trim() + ' ' + heard.trim()).trim() }));
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') A.toast('Allow microphone access to dictate.');
        else if (e.error !== 'no-speech' && e.error !== 'aborted') A.toast('Dictation stopped (' + e.error + ').');
      };
      rec.onend = () => { if (dictation === rec) dictation = null; set({ dictating: false }); };
      dictation = rec;
      try { rec.start(); set({ dictating: true }); } catch { dictation = null; A.toast('Could not start dictation.'); }
    },
    scope: (AI ? AI.providerName + ' ' + AI.model : 'Board data') + '  ·  ' + (role === 'admin' ? 'All projects' : c.scopeName),
    scopeTitle: AI ? 'Answers come from ' + AI.providerName + ' (' + AI.model + ') using board data for your view' : 'Quick answers from board data. Full AI answers turn on when a Super Admin connects a model.',
    busy: !!(curId && chats[curId].pending),
    scopeChip: 'display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 12px; border-radius: 999px; background: var(--chip); font-size: 13px; font-weight: 600; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;',
    scopeDot: 'width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + solid('green')[0] + ';',
    composerStyle: 'position: relative; width: 100%; max-width: 760px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 14px 12px 10px 18px; border: 1px solid var(--border); border-radius: 22px; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08);',
    inputStyle: 'width: 100%; min-height: 40px; box-sizing: border-box; padding: 0; border: 0; background: transparent; font-size: 16px; color: var(--ink);',
    iconBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
    micBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; ' + (s.dictating ? 'background: var(--red-soft); color: var(--red-ink);' : 'background: transparent; color: var(--muted-2);'),
    sendBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: ' + (draft ? 'var(--inv)' : 'var(--chip-2)') + '; color: ' + (draft ? 'var(--inv-ink)' : 'var(--ink-3)') + ';',
    markSm: 'width: 32px; height: 32px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink);',
    markLg: 'width: 64px; height: 64px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink); box-shadow: 0 0 0 8px var(--chip-2);',
    qaStyle: 'display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 14px; box-sizing: border-box; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface); cursor: pointer; letter-spacing: normal;'
  };

  // ---------- Notifications & Activity ----------
  const IV = c.ideas;
  const visibleIdea = {};
  IV.visible.forEach((i) => { visibleIdea[i.id] = true; });
  const NT = { mention: ['Mention', 'violet'], status: ['Status', 'blue'], approval: ['Approval', 'green'], deadline: ['Deadline', 'red'], assign: ['Assignment', 'amber'], idea: ['Idea', 'coral'], comment: ['Comment', 'blue'] };
  const nRead = s.nRead || {};
  const nList = D.notifications.filter((n) => NT[n.event] && (!isSponsor || !n.project_id || scopedId[n.project_id] || n.idea_id)).map((n) => ({
    id: n.id, g: dayGroup(n.created_at, now) === 'today' ? 'Today' : 'Earlier', type: n.event, who: whoOf(n.actor_id, n.actor_label),
    whoRaw: n.actor_label, text: n.text, target: n.target_label, quote: n.quote || '', time: relTime(n.created_at, now),
    isUnread: !n.read_at && !nRead[n.id], idea: !!n.idea_id, ideaId: n.idea_id, projectId: n.project_id
  }));
  const unread = nList.filter((n) => n.isUnread).length;
  const nTab = s.nTab || 'all';
  const nShown = nList.filter((n) => nTab === 'all' || (nTab === 'unread' ? n.isUnread : n.type === nTab));
  const nTabs = [['all', 'All', nList.length], ['unread', 'Unread', unread]].concat(Object.keys(NT).map((k) => [k, { mention: 'Mentions', status: 'Status', approval: 'Approvals', deadline: 'Deadlines', assign: 'Assignments', idea: 'Ideas', comment: 'Comments' }[k], nList.filter((n) => n.type === k).length]).filter((t) => t[2] > 0)).map((t) => tab(t[1], t[2], nTab === t[0], () => set({ nTab: t[0] })));
  const openIdea = (id) => () => set({ nav: 'ideas', ideaOpen: id || '', iStatus: 'all', iType: 'all', iBrand: 'all', iq: '', ideaEdit: null });
  const avatarFor = (w, size) => 'width: ' + size + 'px; height: ' + size + 'px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #FFFFFF; background: ' + (w === 'Automation' ? '#3A3B40' : actColor(w)) + ';';
  const jobOf = (pid) => (rowById[pid] || {}).job || '';
  const nGroups = ['Today', 'Earlier'].map((g) => ({
    title: g,
    items: nShown.filter((n) => n.g === g).map((n, i) => ({
      who: n.who, text: n.text, target: n.target, time: n.time, quote: n.quote, hasQuote: !!n.quote, unread: n.isUnread,
      typeLabel: NT[n.type][0], typeStyle: hardBlock(solid(NT[n.type][1]), 22) + ' font-size: 11px; padding: 0 8px;',
      initials: n.who.slice(0, 1), avatarStyle: avatarFor(n.who, 32),
      dotStyle: 'width: 8px; height: 8px; margin-top: 12px; border-radius: 999px; flex: none; background: ' + (n.isUnread ? '#E0567F' : 'transparent') + ';',
      liStyle: i ? 'border-top: 1px solid var(--line);' : '',
      btnStyle: 'display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 16px 14px 12px; box-sizing: border-box; border: 0; background: transparent; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.4;',
      open: () => {
        if (n.isUnread) { set({ nRead: Object.assign({}, nRead, { [n.id]: true }) }); A.markRead([n.id]); }
        if (n.idea) set({ nav: 'ideas', ideaOpen: n.ideaId || '', iStatus: 'all', iType: 'all', iBrand: 'all', iq: '', ideaEdit: null });
        else set({ nav: 'projects', openJob: jobOf(n.projectId), dTab: (n.type === 'mention' || n.type === 'approval' || n.type === 'comment') ? 'comments' : 'overview', draft: '', menu: '' });
      }
    }))
  })).filter((g) => g.items.length > 0);

  const ACAT = { project: ['Project', 'blue'], idea: ['Idea', 'coral'], approval: ['Approval', 'green'] };
  const acts = D.activity.filter((l) => (l.idea_id ? visibleIdea[l.idea_id] : (l.project_id && scopedId[l.project_id] && (l.category === 'project' || l.category === 'approval'))))
    .map((l) => ({ who: whoOf(l.actor_id, l.actor_label), text: l.action, target: l.target_label, time: relTime(l.created_at, now), today: dayGroup(l.created_at, now) === 'today',
      cat: l.idea_id ? 'idea' : (l.category === 'approval' ? 'approval' : 'project'), projectId: l.project_id, ideaId: l.idea_id }));
  const actGroups = [['Today', true], ['Earlier', false]].map((g) => ({
    title: g[0],
    items: acts.filter((a) => a.today === g[1]).map((a, i) => ({
      who: a.who, text: a.text, target: a.target, time: a.time,
      initials: a.who.slice(0, 1), avatarStyle: avatarFor(a.who, 28),
      cat: ACAT[a.cat][0], catStyle: hardBlock(solid(ACAT[a.cat][1]), 22) + ' font-size: 11px; padding: 0 8px; flex: none;',
      liStyle: i ? 'border-top: 1px solid var(--line);' : '',
      btnStyle: 'display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 10px 16px; box-sizing: border-box; border: 0; background: transparent; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.4;',
      open: a.cat === 'idea' ? openIdea(a.ideaId) : openProj(jobOf(a.projectId))
    }))
  })).filter((g) => g.items.length > 0);
  // Messages from connected tools: Slack, and Buffer comments/DMs (source 'buffer', kind comment | message) once its API
  // shares them. Internal roles only; load.js leaves D.inbox empty for sponsors.
  const showMsgs = !isSponsor;
  const SRC = { slack: ['Slack', 'violet'], buffer: ['Buffer', 'blue'] };
  const MKIND = { mention: 'Mention', dm: 'Direct message', comment: 'Comment' };
  const mRead = s.mRead || {};
  const safeImg = (u) => (/^https:\/\/[^\s"'();\\]+$/.test(u || '') ? u : '');
  const mList = (showMsgs ? D.inbox || [] : []).map((x) => ({
    id: x.id, src: SRC[x.source] ? x.source : 'slack', kind: x.kind, chan: String(x.channel_label || '').replace(/ · thread$/, ''), label: x.channel_label || '',
    who: x.author_name || 'Someone', avatar: safeImg(x.author_avatar_url), text: x.text || '', url: x.url || '', at: x.occurred_at, isUnread: !x.read && !mRead[x.id]
  }));
  const mUnread = mList.filter((m) => m.isUnread).length;
  const markMsgs = (ids) => { if (!ids.length) return; const r = Object.assign({}, mRead); ids.forEach((id) => { r[id] = true; }); set({ mRead: r }); A.markInboxRead(ids); };
  const mKey = (m) => m.src + ':' + m.chan;
  const isMention = (m) => m.kind === 'mention' || m.kind === 'dm' || (m.src === 'buffer' && m.kind === 'message');
  const kindOf = (m) => (m.src === 'buffer' && m.kind === 'message' ? 'Direct message' : MKIND[m.kind] || '');
  const mf = s.mFilter || 'all';
  const mShown = mList.filter((m) => mf === 'all' || (mf === 'unread' ? m.isUnread : mf === 'mention' ? isMention(m) : mf.indexOf('src:') === 0 ? m.src === mf.slice(4) : mKey(m) === mf.slice(3)));
  const mChans = [];
  mList.forEach((m) => { if (mChans.indexOf(mKey(m)) < 0) mChans.push(mKey(m)); });
  const mTabs = [['all', 'All', mList.length], ['unread', 'Unread', mUnread], ['mention', 'Mentions', mList.filter(isMention).length]]
    .concat(Object.keys(SRC).map((k) => ['src:' + k, SRC[k][0], mList.filter((m) => m.src === k).length]))
    .concat(mChans.map((k) => ['ch:' + k, k.slice(k.indexOf(':') + 1) || 'Other', mList.filter((m) => mKey(m) === k).length]))
    .filter((t, i) => i < 2 || t[2] > 0)
    .map((t) => tab(t[1], t[2], mf === t[0], () => set({ mFilter: t[0] })));
  const mGroups = ['Today', 'Earlier'].map((g) => ({
    title: g,
    items: mShown.filter((m) => (dayGroup(m.at, now) === 'today') === (g === 'Today')).map((m, i) => ({
      who: m.who, text: m.text, chan: m.label, time: relTime(m.at, now), unread: m.isUnread,
      initials: m.avatar ? '' : m.who.slice(0, 1),
      avatarStyle: m.avatar ? 'width: 32px; height: 32px; border-radius: 999px; flex: none; background: var(--chip-2) center / cover no-repeat url("' + m.avatar + '");' : avatarFor(m.who, 32),
      srcLabel: SRC[m.src][0], srcStyle: hardBlock(solid(SRC[m.src][1]), 22) + ' font-size: 11px; padding: 0 8px;',
      hasKind: !!kindOf(m), kindLabel: kindOf(m), kindStyle: hardBlock(null, 22) + ' font-size: 11px; padding: 0 8px;',
      dotStyle: 'width: 8px; height: 8px; margin-top: 12px; border-radius: 999px; flex: none; background: ' + (m.isUnread ? '#E0567F' : 'transparent') + ';',
      liStyle: 'position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px 14px 12px;' + (i ? ' border-top: 1px solid var(--line);' : ''),
      hasUrl: !!m.url, url: m.url, openLabel: m.src === 'buffer' ? 'Open post' : 'Open in ' + SRC[m.src][0], open: () => { if (m.isUnread) markMsgs([m.id]); },
      markRead: () => markMsgs([m.id]),
      linkStyle: 'display: inline-flex; align-items: center; gap: 6px; min-height: 32px; font-size: 13px; font-weight: 600; color: var(--link); text-decoration: underline; text-underline-offset: 3px;',
      readStyle: 'min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink-3); font-size: 12px; cursor: pointer;'
    }))
  })).filter((g) => g.items.length > 0);
  const msg = {
    tabs: mTabs, groups: mGroups, empty: mGroups.length === 0,
    emptyText: mList.length ? 'Nothing here with this filter.' : role === 'admin' ? 'No messages yet. Connect Slack in Workspace Settings to bring channel messages and mentions here.' : 'No messages yet. A Super Admin can connect Slack to bring messages here.',
    // Buffer is connected but its API has no comments or DMs to read (see providers/buffer.ts); say so where admins look.
    hasNote: role === 'admin' && (D.integrations || []).some((g) => g.provider === 'buffer' && g.status === 'connected') && !mList.some((m) => m.src === 'buffer'),
    note: 'Buffer is connected, but its API does not share comments or DMs yet, so they stay in Buffer.',
    canConnect: !mList.length && role === 'admin', goConnect: () => set({ nav: 'workspace', wsTab: 'integ' })
  };
  const naTab = s.naTab === 'msgs' && !showMsgs ? 'notif' : s.naTab || 'notif';
  const modeBtn = (on) => 'min-height: 36px; padding: 0 12px 0 14px; border: 0; border-radius: 10px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);');
  const nt = {
    modes: [['notif', 'Notifications', unread], ['activity', 'Activity', acts.length]].concat(showMsgs ? [['msgs', 'Messages', mUnread]] : []).map((m) => ({ label: m[1], count: String(m[2]), badge: GRAYP, selected: naTab === m[0] ? 'true' : 'false', pick: () => set({ naTab: m[0] }), style: modeBtn(naTab === m[0]) })),
    isNotif: naTab === 'notif', isActivity: naTab === 'activity', isMsgs: naTab === 'msgs', msg: msg,
    tabs: nTabs, groups: nGroups, empty: nGroups.length === 0,
    actGroups: actGroups, actEmpty: actGroups.length === 0,
    actNote: role === 'admin' ? 'Changes on projects and ideas across the workspace.' : isSponsor ? 'Updates on ' + acctName + ' projects and ideas.' : 'Changes on the projects and ideas you are assigned to.',
    showAudit: role === 'admin', goLogs: () => set({ nav: 'logs' })
  };

  // ---------- Content ----------
  const DOTC = dark ? { 'Done': '#3FCF73', 'Drafted': '#5B8BFF', 'Ongoing': '#F5B83D', 'Not Yet': '#4A4C52' } : { 'Done': '#3DB46D', 'Drafted': '#4C7CF0', 'Ongoing': '#E0A526', 'Not Yet': '#C4C4C4' };
  // YouTube sync (youtube_videos): real thumbnails and public stats. A board project matches by its video ID.
  const ytInteg = (D.integrations || []).find((g) => g.provider === 'youtube') || null;
  const ytOn = !!ytInteg && ytInteg.status === 'connected';
  const ytVids = D.youtube || [];
  const ytOf = {};
  ytVids.forEach((v) => { if (v.project_id && !ytOf[v.project_id]) ytOf[v.project_id] = v; });
  const ytChannel = (v) => { const t = String(v.channel_title || '').toLowerCase(); const m = D.channels.find((x) => x.youtube_channel_id && x.youtube_channel_id === v.channel_id) || D.channels.find((x) => x.name.toLowerCase() === t); return m ? m.name : v.channel_title || ''; };
  const ytDay = (ts) => (ts ? TODAY - Math.round((startOfDay(now) - startOfDay(new Date(ts))) / 86400000) : null);
  const ytDate = (ts) => { if (!ts) return ''; const d = new Date(ts); return MONTHS[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== now.getFullYear() ? ', ' + d.getFullYear() : ''); };
  const ytDur = (n) => { const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0'); };
  const watchUrl = (v) => 'https://www.youtube.com/watch?v=' + v.video_id;
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  const ytM = (v) => ({ views: Number(v.views || 0), likes: num(v.likes), comments: num(v.comments) });
  const mOf = (id) => { if (ytOf[id]) return ytM(ytOf[id]); const m = metricOf[id]; return m ? { views: Number(m.views), likes: Number(m.likes), comments: null } : null; };
  const distOf = (r) => ({ clipping: r.clipping || 'Not Yet', newsletter: r.newsletter || 'Not Yet', community: r.community || 'Not Yet', distribute: r.distribute || 'Not Yet' });
  const toC = (r, onBoard) => {
    const v = ytOf[r.id] || null;
    // Board dates are year-less labels: a Live one that reads as a future date was last year.
    const d0 = di(r.pub), day = v ? ytDay(v.published_at) : d0 !== null && r.status === 'Live' && d0 > TODAY ? d0 - 365 : d0;
    return { id: r.id, title: r.title, channel: r.channel || (v ? ytChannel(v) : ''), type: r.type, pub: v ? ytDate(v.published_at) : r.pub, day: day, live: r.status === 'Live' || (!!v && v.live_status !== 'upcoming'), m: mOf(r.id), dist: distOf(r), job: onBoard ? r.job : '', linkUrl: v ? watchUrl(v) : r.linkUrl, yt: v };
  };
  const boardC = scoped.filter((r) => r.status === 'Live' || r.status === 'Scheduled').map((r) => toC(r, true));
  const catC = c.catalogRows.map((r) => toC(r, false));
  // Synced videos not already shown through a board or catalog project. A matched project elsewhere on the board keeps its Open project button.
  const seenP = {};
  boardC.concat(catC).forEach((x) => { seenP[x.id] = true; });
  const ytC = ytVids.filter((v) => !(v.project_id && seenP[v.project_id])).map((v) => {
    const r = v.project_id ? rowById[v.project_id] || null : null;
    return { id: v.project_id || 'yt:' + v.video_id, title: v.title, channel: r && r.channel ? r.channel : ytChannel(v), type: r ? r.type : '', pub: ytDate(v.published_at), day: ytDay(v.published_at), live: v.live_status !== 'upcoming', m: ytM(v), dist: r ? distOf(r) : null, job: r ? r.job : '', linkUrl: watchUrl(v), yt: v };
  });
  const allC = boardC.concat(catC, ytC).sort((a, b) => (b.day === null ? -1e9 : b.day) - (a.day === null ? -1e9 : a.day));
  const cTab = s.cTab || 'all';
  const cCh = s.cCh || 'all';
  const cShown = allC.filter((x) => (cTab === 'all' || x.type === cTab) && (cCh === 'all' || x.channel === cCh));
  const cTabs = [['all', 'All', null]].concat(D.types.map((x) => [x.label, x.label, x.label])).map((t) => Object.assign(tab(t[1], t[0] === 'all' ? allC.length : allC.filter((x) => x.type === t[0]).length, cTab === t[0], () => set({ cTab: t[0] })), { swatch: t[2] ? 'width: 10px; height: 10px; flex: none; background: ' + TYPEFILL[t[2]][0] + ';' : 'display: none;' }));
  const cnt = (n) => (n === null ? '–' : fmtCount(n));
  const items = cShown.map((x) => {
    const f = TYPEFILL[x.type] || ['#6B6B6B', '#FFFFFF'];
    const v = x.yt;
    const st = v && v.live_status === 'live' ? 'Live now' : v && v.live_status === 'upcoming' ? 'Upcoming' : x.live ? (x.job ? 'Live' : 'Published') : 'Scheduled';
    const img = v && v.thumbnail_url ? v.thumbnail_url : '';
    return {
      title: x.title, type: x.type, thumbText: img ? '' : x.title,
      hasImg: !!img, img: img, hasDur: !!(v && v.duration_seconds), dur: v ? ytDur(v.duration_seconds) : '',
      durStyle: 'position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 6px; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; background: rgba(0,0,0,0.8); color: #FFFFFF;',
      meta: x.channel + '  ·  ' + (x.live ? 'Published ' : 'Scheduled for ') + x.pub,
      thumbStyle: 'position: relative; aspect-ratio: 16 / 9; display: flex; flex-direction: column; justify-content: flex-end; padding: 44px 16px 16px; box-sizing: border-box; overflow: hidden; background: ' + f[0] + '; color: ' + f[1] + ';',
      typeStyle: x.type ? 'position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: ' + f[1] + '; color: ' + f[0] + ';' : 'display: none;',
      state: st,
      stateStyle: 'position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 700; background: var(--surface); color: var(--ink);',
      hasMetrics: !!x.m, noMetrics: !x.m,
      metrics: x.m ? [{ label: 'Views', value: cnt(x.m.views) }, { label: 'Likes', value: cnt(x.m.likes) }, { label: 'Comments', value: cnt(x.m.comments) }] : [],
      pendingText: x.live && ytOn ? 'Published ' + x.pub + '. Add the YouTube link to the project to pull its stats.' : (x.live ? 'Published ' : 'Goes live ') + x.pub + '. Metrics show up 24 hours after publish.',
      dist: x.dist ? [['clipping', 'Clipping'], ['newsletter', 'Newsletter'], ['community', 'Community'], ['distribute', 'Distribute']].map((d) => ({ label: d[1], state: ': ' + x.dist[d[0]], dotStyle: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + (DOTC[x.dist[d[0]]] || '#C4C4C4') + ';' })) : [],
      linkText: x.live || v ? 'Watch on YouTube' : 'Preview draft', href: x.linkUrl || '', hasLink: !!x.linkUrl,
      hasProject: !!x.job, open: x.job ? openProj(x.job) : () => {}, aria: 'Open project ' + x.title
    };
  });
  const withM = cShown.filter((x) => x.m);
  const ytChNames = [];
  ytVids.forEach((v) => { const n = ytChannel(v); if (n && !D.channels.some((x) => x.name === n) && ytChNames.indexOf(n) < 0) ytChNames.push(n); });
  const syncedAt = ytOn && ytInteg.last_synced_at ? ytInteg.last_synced_at : null;
  const ct = {
    tabs: cTabs, items: items, empty: items.length === 0,
    emptyText: !ytOn ? 'Nothing published in this view yet. Connect YouTube in Workspace Settings to pull your posted videos.' : !syncedAt ? 'Nothing here yet. Use Sync now to pull your YouTube videos.' : 'Nothing published in this view yet.',
    channels: [['all', 'All channels']].concat(D.channels.map((x) => [x.name, x.name]), ytChNames.map((n) => [n, n])).map((o) => ({ value: o[0], label: o[1], on: o[0] === cCh })),
    onChannel: (e) => set({ cCh: e && e.target ? e.target.value : 'all' }),
    linkStyle: 'display: inline-flex; align-items: center; gap: 6px; min-height: 36px; color: var(--link); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap;',
    openBtn: 'min-height: 36px; margin-left: auto; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;',
    imgStyle: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block;',
    syncNote: syncedAt ? 'YouTube synced ' + relTime(syncedAt, now) : ytOn ? 'YouTube not synced yet' : 'YouTube not connected',
    syncLabel: !ytOn ? 'Connect YouTube' : s.integBusy === 'youtube:sync' ? 'Syncing…' : 'Sync now',
    syncPick: () => {
      if (!ytOn) { set({ nav: 'workspace', wsTab: 'integ' }); return; }
      if (s.integBusy) return;
      set({ integBusy: 'youtube:sync' });
      A.syncIntegration(ytInteg).then(() => set({ integBusy: '' }));
    }
  };
  const sumOf = (k) => withM.reduce((a, x) => a + (x.m[k] || 0), 0);
  const sumViews = sumOf('views');
  const engRows = withM.filter((x) => x.m.views > 0 && (x.m.likes !== null || x.m.comments !== null));
  const engViews = engRows.reduce((a, x) => a + x.m.views, 0);
  const engPct = engViews ? engRows.reduce((a, x) => a + (x.m.likes || 0) + (x.m.comments || 0), 0) / engViews * 100 : null;

  // Buffer sync (buffer_channels, buffer_posts): sent social posts with Buffer's normalized metrics, in the Social
  // view. Buffer refreshes metrics daily; a metric the network did not report is null, not zero.
  const bfInteg = (D.integrations || []).find((g) => g.provider === 'buffer') || null;
  const bfOn = !!bfInteg && bfInteg.status === 'connected';
  const BF = D.buffer || { channels: [], posts: [] };
  const cView = !isSponsor && s.cView === 'social' ? 'social' : 'videos';
  const SVC = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', twitter: 'X', facebook: 'Facebook', youtube: 'YouTube', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest', mastodon: 'Mastodon', googlebusiness: 'Google Business', substack: 'Substack', startPage: 'Start Page', whatsapp: 'WhatsApp' };
  const svc = (k) => SVC[k] || k || 'Social';
  const bfCh = {};
  BF.channels.forEach((x) => { bfCh[x.channel_id] = x; });
  const bfName = (x) => (x ? x.display_name || x.name || svc(x.service) : 'Removed channel');
  const sCh = s.sCh && bfCh[s.sCh] ? s.sCh : 'all';
  const nz = (v) => (v === null || v === undefined ? null : Number(v));
  const seenOf = (p) => nz(p.impressions) ?? nz(p.views) ?? nz(p.reach);
  const engOf = (p) => ['reactions', 'comments', 'shares', 'reposts', 'saves'].reduce((a, k) => a + (nz(p[k]) || 0), 0);
  const hasM = (p) => Array.isArray(p.metrics) && p.metrics.length > 0;
  const sentAt = (p) => p.sent_at || p.due_at || p.created_at;
  const recent = (p) => now.getTime() - new Date(sentAt(p)).getTime() <= 30 * 86400000;
  const bfPct = (v) => (v === null ? '–' : (v < 10 ? v.toFixed(1) : String(Math.round(v))) + '%');
  const roll = (list) => {
    const m = list.filter(hasM), seenRows = m.filter((p) => seenOf(p) > 0);
    const seen = m.reduce((a, p) => a + (seenOf(p) || 0), 0), eng = m.reduce((a, p) => a + engOf(p), 0);
    const seenTot = seenRows.reduce((a, p) => a + seenOf(p), 0);
    return { posts: list.length, seen: seen, eng: eng, rate: seenTot ? seenRows.reduce((a, p) => a + engOf(p), 0) / seenTot * 100 : null };
  };
  const bfShown = BF.posts.filter((p) => sCh === 'all' || p.channel_id === sCh);
  const r30 = roll(bfShown.filter(recent));
  const sTabs = [['all', 'All channels', BF.posts.length]].concat(BF.channels.map((x) => [x.channel_id, bfName(x), BF.posts.filter((p) => p.channel_id === x.channel_id).length]))
    .map((t) => tab(t[1], t[2], sCh === t[0], () => set({ sCh: t[0] })));
  const MCOL = [['impressions', 'Impressions'], ['views', 'Views'], ['reach', 'Reach'], ['reactions', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['reposts', 'Reposts'], ['saves', 'Saves'], ['clicks', 'Clicks']];
  const bfChannels = BF.channels.map((x) => {
    const r = roll(BF.posts.filter((p) => p.channel_id === x.channel_id && recent(p)));
    const img = safeImg(x.avatar_url);
    return {
      name: bfName(x), sub: svc(x.service) + (x.name && x.name !== bfName(x) ? '  ·  @' + String(x.name).replace(/^@/, '') : ''),
      initials: img ? '' : bfName(x).slice(0, 1),
      avatarStyle: img ? 'width: 36px; height: 36px; border-radius: 999px; flex: none; background: var(--chip-2) center / cover no-repeat url("' + img + '");' : avatarFor(bfName(x), 36),
      warn: x.is_disconnected ? 'Disconnected in Buffer' : x.is_locked ? 'Locked in Buffer' : '', hasWarn: !!(x.is_disconnected || x.is_locked),
      warnStyle: hardBlock(solid('red'), 22) + ' font-size: 11px; padding: 0 8px; align-self: flex-start;',
      stats: [{ label: 'Posts', value: String(r.posts) }, { label: 'Impressions', value: fmtCount(r.seen) }, { label: 'Engagements', value: fmtCount(r.eng) }, { label: 'Eng. rate', value: bfPct(r.rate) }],
      pressed: sCh === x.channel_id ? 'true' : 'false', pick: () => set({ sCh: sCh === x.channel_id ? 'all' : x.channel_id }),
      style: 'display: flex; flex-direction: column; gap: 12px; padding: 16px; box-sizing: border-box; border: 1px solid ' + (sCh === x.channel_id ? 'var(--ink)' : 'var(--line)') + '; border-radius: 18px; background: var(--surface); text-align: left; cursor: pointer; letter-spacing: normal; color: var(--ink);'
    };
  });
  const bfItems = bfShown.slice(0, 100).map((p, i) => {
    const ch = bfCh[p.channel_id] || null, img = safeImg(p.thumbnail_url), when = sentAt(p);
    const ms = MCOL.filter((k) => nz(p[k[0]]) !== null).map((k) => ({ label: k[1], value: fmtCount(nz(p[k[0]])) }));
    if (nz(p.engagement_rate) !== null) ms.push({ label: 'Eng. rate', value: bfPct(nz(p.engagement_rate)) });
    return {
      text: p.text || '(No text)', hasImg: !!img, img: img,
      meta: bfName(ch) + '  ·  ' + svc(p.service) + (when ? '  ·  ' + ytDate(when) : ''),
      hasMetrics: ms.length > 0, metrics: ms.slice(0, 8),
      pendingText: 'No metrics from ' + svc(p.service) + ' yet. Buffer pulls them about once a day.',
      fresh: p.metrics_updated_at ? 'Metrics updated ' + relTime(p.metrics_updated_at, now).replace(/^(Just|Yesterday|Today)/, (w) => w.toLowerCase()) : '',
      hasUrl: !!safeImg(p.external_link), url: safeImg(p.external_link), openLabel: 'Open on ' + svc(p.service),
      liStyle: 'display: flex; align-items: flex-start; gap: 14px; padding: 16px;' + (i ? ' border-top: 1px solid var(--line);' : '')
    };
  });
  const bfSynced = bfOn && bfInteg.last_synced_at ? bfInteg.last_synced_at : null;
  ct.hasViews = !isSponsor;
  ct.isVideos = cView === 'videos';
  ct.isSocial = cView === 'social';
  ct.views = [['videos', 'Videos', allC.length], ['social', 'Social', BF.posts.length]].map((m) => ({ label: m[1], count: String(m[2]), badge: GRAYP, selected: cView === m[0] ? 'true' : 'false', pick: () => set({ cView: m[0] }), style: modeBtn(cView === m[0]) }));
  ct.social = {
    tabs: sTabs, hasTabs: BF.channels.length > 1, channels: bfChannels, hasChannels: bfChannels.length > 0, items: bfItems, hasItems: bfItems.length > 0,
    more: bfShown.length > 100 ? 'Showing the latest 100 of ' + bfShown.length + ' posts.' : '',
    empty: !bfItems.length,
    emptyText: BF.posts.length ? 'No sent posts on this channel yet.' : !bfOn ? (role === 'admin' ? 'Connect Buffer in Workspace Settings to see sent social posts and how they performed.' : 'A Super Admin can connect Buffer to show social posts here.') : !bfSynced ? 'Nothing here yet. Use Sync now to pull your Buffer posts.' : 'No sent posts in Buffer yet.',
    canConnect: !bfOn && role === 'admin', goConnect: () => set({ nav: 'workspace', wsTab: 'integ' }),
    // Where a Super Admin looks for comments: Buffer's GraphQL API has no query for them (see providers/buffer.ts).
    gap: role === 'admin' ? 'Comments and DMs stay in Buffer. Its API shares posts and metrics, not conversations, so they cannot come into the Inbox yet.' : '',
    imgStyle: 'width: 72px; height: 72px; flex: none; object-fit: cover; display: block; border-radius: 10px; background: var(--chip-2);',
    mStyle: 'display: inline-flex; align-items: baseline; gap: 4px; font-size: 12px; color: var(--muted-2);'
  };
  if (ct.isSocial) {
    ct.syncNote = bfSynced ? 'Buffer synced ' + relTime(bfSynced, now) : bfOn ? 'Buffer not synced yet' : 'Buffer not connected';
    ct.syncLabel = !bfOn ? 'Connect Buffer' : s.integBusy === 'buffer:sync' ? 'Syncing…' : 'Sync now';
    ct.syncPick = () => {
      if (!bfOn) { set({ nav: 'workspace', wsTab: 'integ' }); return; }
      if (s.integBusy) return;
      set({ integBusy: 'buffer:sync' });
      A.syncIntegration(bfInteg).then(() => set({ integBusy: '' }));
    };
  }
  const socialStats = [
    { label: 'Impressions, 30 days', value: fmtCount(r30.seen), sub: 'Views where the network reports no impressions' },
    { label: 'Engagements, 30 days', value: fmtCount(r30.eng), sub: 'Likes, comments, shares, reposts and saves' },
    { label: 'Engagement rate', value: bfPct(r30.rate), sub: 'Engagements per impression' },
    { label: 'Posts sent, 30 days', value: String(r30.posts), sub: sCh === 'all' ? BF.channels.length + ' channels in Buffer' : bfName(bfCh[sCh]) }
  ];
  const videoStats = [
    { label: 'Views, all time', value: fmtCount(sumViews), sub: withM.length + ' published videos in view' },
    { label: 'Engagement', value: engPct === null ? '–' : (engPct < 10 ? engPct.toFixed(1) : String(Math.round(engPct))) + '%', sub: 'Likes and comments per view' },
    { label: 'Scheduled', value: String(cShown.filter((x) => !x.live).length), sub: 'Waiting to publish' },
    { label: 'Need clipping', value: String(cShown.filter((x) => x.live && x.dist && x.dist.clipping !== 'Done').length), sub: 'Live without short clips' }
  ];
  const contentStats = ct.isSocial ? socialStats : videoStats;

  // ---------- Brand ----------
  const BRANDS = c.authBrands;
  const kitOf = {};
  D.brands.forEach((b) => { kitOf[b.name] = b; });
  const isChannel = (b) => !!kitOf[b] && kitOf[b].kind === 'channel';
  const bCh = BRANDS.indexOf(s.brCh) >= 0 ? s.brCh : (BRANDS[0] || '');
  const kb = kitOf[bCh] || { colors: [], fonts: [], tone: [], dos: [], donts: [], sections: [], assets: [] };
  const secs = kb.sections || [];
  const K = { colors: kb.colors || [], fonts: kb.fonts || [], tone: kb.tone || [], dos: kb.dos || [], donts: kb.donts || [] };
  const lumOf = (h) => { const x = h.replace('#', ''); const v = [0, 2, 4].map((i) => parseInt(x.substr(i, 2), 16) / 255).map((u) => u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const mark = (ok) => { const f = ok ? solid('green') : solid('red'); return 'width: 20px; height: 20px; flex: none; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: ' + f[0] + '; color: ' + f[1] + ';'; };
  const brandRows = (b) => scoped.filter((r) => r.channel === b || r.sponsor === b);
  const ini = (b) => b.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const pickerItem = (b) => {
    const on = b === bCh;
    const n = brandRows(b).length;
    return { name: b, initials: ini(b), sub: n + (n === 1 ? ' project' : ' projects'), current: on ? 'page' : 'false', pick: () => set({ brCh: b }), tile: c.brandTile(32),
      style: 'display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 10px; box-sizing: border-box; border: 0; border-radius: 12px; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.3; background: ' + (on ? 'var(--chip-2)' : 'transparent') + ';' };
  };
  const readOnly = role !== 'admin';
  const kit = kitOf[bCh] || null;
  const onText = (h) => (/^#[0-9a-f]{6}$/i.test(h || '') && lumOf(h) < 0.45 ? '#FFFFFF' : '#111111');
  const accentTile = (b, size) => { const k = kitOf[b]; return c.brandTile(size) + (k && k.color ? ' background: ' + k.color + '; color: ' + onText(k.color) + ';' : ''); };
  const fileSize = (n) => !n ? '' : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
  const fileMeta = (a) => [String(a.name || '').split('.').pop().toUpperCase(), fileSize(a.size), a.at ? relTime(a.at, now) : ''].filter(Boolean).join('  ·  ');
  const kAssets = (kb.assets || []).filter(Boolean);
  const logoFiles = kAssets.filter((a) => !Array.isArray(a) && a.kind === 'logo');
  const otherFiles = kAssets.filter((a) => Array.isArray(a) || a.kind !== 'logo');
  const urls = kb.logoUrls || {};

  // app: Super Admins create brands. A channel brand also gets a channel so projects can link to it.
  const nb = {
    open: !!s.brNew,
    name: s.brNewName || '', kind: s.brNewKind || 'channel',
    onName: (e) => set({ brNewName: e && e.target ? e.target.value : '', brErr: '' }),
    kinds: [['channel', 'Channel', 'A show or channel you produce'], ['sponsor', 'Sponsor', 'A brand that sponsors your projects']].map((k) => {
      const on = (s.brNewKind || 'channel') === k[0];
      return { label: k[1], desc: k[2], on: on ? 'true' : 'false', pick: () => set({ brNewKind: k[0] }),
        style: 'flex: 1 1 180px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; border-radius: 12px; text-align: left; cursor: pointer; background: ' + (on ? 'var(--chip-2)' : 'transparent') + '; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + ';' };
    }),
    // Sponsor brands: which sponsor account it belongs to. Accounts that already have a brand are left out.
    isSponsor: (s.brNewKind || 'channel') === 'sponsor',
    account: s.brNewAcct === undefined ? 'new' : s.brNewAcct,
    onAccount: (e) => set({ brNewAcct: e && e.target ? e.target.value : 'new' }),
    accounts: [{ value: 'new', label: 'New sponsor account' }]
      .concat(D.accounts.filter((a) => a.type === 'sponsor' && !D.brands.some((b) => b.account_id === a.id)).map((a) => ({ value: a.id, label: a.name })))
      .concat([{ value: '', label: 'No account (only Super Admins can see it)' }]),
    accountHelp: (s.brNewAcct === undefined || s.brNewAcct === 'new') ? 'Creates a sponsor account with this name, with the portal off. Invite a contact from Clients & Sponsors.'
      : s.brNewAcct ? 'The sponsor and the team on its projects can see this brand.' : 'Link an account later to share it with the sponsor and the team.',
    err: s.brErr || '', hasErr: !!s.brErr, busy: !!s.brBusy,
    close: () => set({ brNew: false, brErr: '' }),
    create: () => {
      const name = (s.brNewName || '').trim();
      if (!name) return set({ brErr: 'Give the brand a name.' });
      if (D.brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) return set({ brErr: 'A brand with that name already exists.' });
      set({ brBusy: true });
      A.createBrand({ name: name, kind: s.brNewKind || 'channel', account: s.brNewAcct === undefined ? 'new' : s.brNewAcct })
        .then(() => set({ brNew: false, brBusy: false, brNewName: '', brErr: '', brCh: name }))
        .catch((err) => set({ brBusy: false, brErr: err.message }));
    }
  };
  const openNewBrand = () => set({ brNew: true, brNewName: '', brNewKind: 'channel', brNewAcct: undefined, brErr: '', brBusy: false });

  // app: one dialog edits everything stored on the brand kit.
  const ed = s.brEdit || null;
  const ue = (patch) => set({ brEdit: Object.assign({}, s.brEdit, patch) });
  const val = (e) => (e && e.target ? e.target.value : '');
  const rowsOf = (key, cols) => ((ed && ed[key]) || []).map((row, i) => {
    const o = { remove: () => ue({ [key]: ed[key].filter((x, j) => j !== i) }), aria: 'Remove row ' + (i + 1) };
    cols.forEach((col, ci) => {
      o[col] = row[ci] || '';
      o['on' + col.charAt(0).toUpperCase() + col.slice(1)] = (e) => { const v = val(e); ue({ [key]: ed[key].map((x, j) => (j === i ? x.map((y, k) => (k === ci ? v : y)) : x)) }); };
    });
    return o;
  });
  const normHex = (h) => { let x = String(h || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(x)) x = x.split('').map((ch) => ch + ch).join(''); return /^[0-9a-f]{6}$/i.test(x) ? '#' + x.toUpperCase() : ''; };
  const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const edit = !ed ? null : {
    name: ed.name, onName: (e) => ue({ name: val(e) }),
    color: ed.color, colorPick: normHex(ed.color) || '#5F5F5F', onColor: (e) => ue({ color: val(e) }),
    colors: rowsOf('colors', ['name', 'hex']).map((r) => Object.assign(r, { pick: normHex(r.hex) || '#FFFFFF' })),
    addColor: () => ue({ colors: (ed.colors || []).concat([['', '#']]) }),
    fonts: rowsOf('fonts', ['name', 'use', 'weight']),
    addFont: () => ue({ fonts: (ed.fonts || []).concat([['', '', '400']]) }),
    tone: ed.tone, onTone: (e) => ue({ tone: val(e) }),
    dos: ed.dos, onDos: (e) => ue({ dos: val(e) }),
    donts: ed.donts, onDonts: (e) => ue({ donts: val(e) }),
    sections: rowsOf('sections', ['title', 'text']),
    addSection: () => ue({ sections: (ed.sections || []).concat([['', '']]) }),
    voiceLabel: isChannel(bCh) ? 'Voice' : 'Talking points',
    err: s.brErr || '', hasErr: !!s.brErr,
    confirm: !!s.brDel,
    delLabel: s.brDel ? 'Confirm delete' : 'Delete brand',
    delNote: s.brDel ? 'This deletes ' + bCh + ', its files and every idea filed under it. It cannot be undone.' : '',
    del: () => {
      if (!s.brDel) return set({ brDel: true });
      set({ brEdit: null, brDel: false, brCh: '' });
      A.deleteBrand(kit);
    },
    close: () => set({ brEdit: null, brDel: false, brErr: '' }),
    save: () => {
      const name = (ed.name || '').trim();
      if (!name) return set({ brErr: 'The brand needs a name.' });
      if (D.brands.some((b) => b.id !== kit.id && b.name.toLowerCase() === name.toLowerCase())) return set({ brErr: 'Another brand already uses that name.' });
      const accent = String(ed.color || '').trim() ? normHex(ed.color) : '';
      if (String(ed.color || '').trim() && !accent) return set({ brErr: 'Accent color must be a hex code like #1A73E8.' });
      const colors = (ed.colors || []).filter((r) => (r[0] || '').trim() || normHex(r[1]));
      const bad = colors.find((r) => !normHex(r[1]));
      if (bad) return set({ brErr: 'Fix the hex code for ' + ((bad[0] || '').trim() || 'the unnamed color') + '.' });
      const patch = {
        name: name, color: accent || null,
        colors: colors.map((r) => [(r[0] || '').trim() || normHex(r[1]), normHex(r[1])]),
        fonts: (ed.fonts || []).filter((r) => (r[0] || '').trim()).map((r) => [r[0].trim(), (r[1] || '').trim(), "'" + r[0].trim().replace(/'/g, '') + "', system-ui, sans-serif", String(r[2] || '400').trim() || '400']),
        tone: String(ed.tone || '').split(',').map((x) => x.trim()).filter(Boolean),
        dos: lines(ed.dos), donts: lines(ed.donts),
        sections: (ed.sections || []).filter((r) => (r[0] || '').trim() && lines(r[1]).length).map((r) => [r[0].trim(), lines(r[1])])
      };
      set({ brEdit: null, brErr: '', brDel: false, brCh: name });
      A.updateBrand(kit, patch);
    }
  };
  const openEdit = () => set({ brErr: '', brDel: false, brEdit: {
    name: bCh, color: kb.color || '',
    colors: K.colors.map((x) => [x[0], x[1]]),
    fonts: K.fonts.map((x) => [x[0], x[1], String(x[3] || '400')]),
    tone: K.tone.join(', '), dos: K.dos.join('\n'), donts: K.donts.join('\n'),
    sections: secs.map((x) => [x[0], (x[1] || []).join('\n')])
  } });

  const br = {
    hasPicker: BRANDS.length > 1,
    groups: [['Channels', BRANDS.filter(isChannel)], ['Sponsors', BRANDS.filter((b) => !isChannel(b))]].filter((g) => g[1].length).map((g) => ({ title: g[0], items: g[1].map((b) => Object.assign(pickerItem(b), { tile: accentTile(b, 32) })) })),
    isEmpty: BRANDS.length === 0,
    emptyTitle: role === 'admin' ? 'Add your first brand' : 'No brands yet',
    emptyText: role === 'admin'
      ? 'Brands hold the logos, colors, type and voice the team works from. Every idea belongs to a brand, so add one to start filing ideas.'
      : isSponsor ? 'Your brand kit has not been set up yet. The production team adds it.' : 'Brands show up here once you are assigned to a project for one.',
    canAdd: role === 'admin', add: openNewBrand,
    name: bCh || 'No brands yet', initials: ini(bCh || '-'), tileLg: accentTile(bCh, 48),
    kind: isChannel(bCh) ? 'Channel' : 'Sponsor', kindStyle: hardBlock(solid(isChannel(bCh) ? 'blue' : 'amber'), 26),
    sub: (isChannel(bCh) ? 'Channel brand' : 'Sponsor brand') + '  ·  ' + brandRows(bCh).length + ' linked projects in your view',
    readOnly: readOnly, canEdit: !readOnly && !!kit, openEdit: openEdit,
    uploadLogo: () => kit && A.uploadBrandFile(kit, 'logo'),
    uploadFile: () => kit && A.uploadBrandFile(kit, 'file'),
    logos: logoFiles.map((a) => ({
      name: a.name, url: urls[a.path] || '', hasUrl: !!urls[a.path], aria: 'Download ' + a.name, removeAria: 'Remove ' + a.name,
      open: () => A.openBrandFile(a), remove: () => A.removeBrandFile(kit, a), canRemove: !readOnly
    })),
    logoNote: logoFiles.length ? '' : readOnly ? 'No logo files yet. A Super Admin adds them.' : 'No logo files yet. Upload PNG, SVG or JPG files.',
    fontsNote: K.fonts.length ? '' : 'No fonts saved for this brand.',
    colorsNote: K.colors.length ? '' : 'No colors saved for this brand.',
    fonts: K.fonts.map((f) => ({ name: f[0], use: f[1], sampleStyle: 'width: 72px; flex: none; font-family: ' + f[2] + '; font-weight: ' + f[3] + '; font-size: 40px; line-height: 1; letter-spacing: -0.02em; color: var(--ink);' })),
    colors: K.colors.map((cl) => ({
      name: cl[0], hex: cl[1], aria: 'Copy ' + cl[0] + ' ' + cl[1], btn: s.copied === cl[1] ? 'Copied' : 'Copy',
      swatch: 'display: block; height: 72px; background: ' + cl[1] + ';' + (lumOf(cl[1]) > 0.85 ? ' border-bottom: 1px solid var(--line);' : ''),
      copy: () => { try { if (navigator.clipboard) navigator.clipboard.writeText(cl[1]); } catch (e) {} set({ copied: cl[1] }); }
    })),
    tagStyle: 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600;',
    rules: [
      { title: isChannel(bCh) ? 'Voice' : 'Talking points', hasTags: K.tone.length > 0, tags: K.tone, items: K.dos.map((t) => ({ text: t, mark: '+', markStyle: mark(true) })).concat(K.donts.map((t) => ({ text: t, mark: '−', markStyle: mark(false) }))) }
    ].concat(secs.map((sc) => ({ title: sc[0], hasTags: false, tags: [], items: (sc[1] || []).map((t) => ({ text: t, mark: '+', markStyle: mark(true) })) })))
      .filter((rl) => rl.tags.length || rl.items.length),
    rulesNote: !kit || K.tone.length || K.dos.length || K.donts.length || secs.length ? '' : readOnly ? 'No voice or rules saved for this brand.' : 'No voice or rules yet. Use Edit brand to add tone, do\'s and don\'ts.',
    refsNote: brandRows(bCh).length ? '' : 'No projects linked to this brand yet.',
    assetsNote: otherFiles.length ? '' : readOnly ? 'No files saved for this brand.' : 'No files yet. Upload guidelines, packs or templates.',
    refs: brandRows(bCh).slice(0, 4).map((r) => ({ name: r.title, meta: r.status + '  ·  Pub ' + r.pub, isProject: true, isLink: false, open: openProj(r.job), aria: 'Open ' + r.title })),
    assets: otherFiles.map((a) => Array.isArray(a)
      ? { name: a[0], meta: a[1], aria: 'Download ' + a[0], canOpen: false, open: () => {}, canRemove: false, remove: () => {}, removeAria: '' }
      : { name: a.name, meta: fileMeta(a), aria: 'Download ' + a.name, canOpen: true, open: () => A.openBrandFile(a), canRemove: !readOnly, remove: () => A.removeBrandFile(kit, a), removeAria: 'Remove ' + a.name }),
    nb: nb, edit: edit, hasEdit: !!edit
  };

  // ---------- Settings ----------
  const prof = Object.assign({ name: me.fullName, email: me.email }, s.prof || {});
  const setProf = (patch) => { set({ prof: Object.assign({}, prof, patch) }); if (patch.name !== undefined) A.saveProfileName(patch.name); };
  const R = ROLES.find((x) => x.id === role) || ROLES[0];
  const prefs = me.prefs || {};
  const myN = Object.assign({ digest: false, slack: false, push: false, quiet: false }, prefs.myN || {}, s.myN || {});
  const mfaOn = s.mfa === undefined ? !!prefs.mfa : !!s.mfa;
  const allowed = c.allowedViews;
  const VIEWS = [['table', 'Table'], ['kanban', 'Kanban'], ['list', 'List'], ['timeline', 'Timeline'], ['calendar', 'Calendar']].filter((v) => allowed.indexOf(v[0]) >= 0);
  const pf = {
    name: prof.name, email: prof.email,
    initials: String(prof.name || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    avatarStyle: 'width: 56px; height: 56px; border-radius: 999px; flex: none; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #FFFFFF; background: ' + actColor(first(prof.name)) + ';',
    roleLabel: me.dbRole === 'client' ? 'Client' : R.label, roleStyle: hardBlock(role === 'admin' ? ['var(--inv)', 'var(--inv-ink)'] : solid({ editor: 'blue', sponsor: 'amber', designer: 'violet' }[role]), 24) + ' align-self: flex-start;',
    roleNote: role === 'admin' ? (me.isOwner ? 'You own this workspace. Manage everyone else from Admin.' : 'You have full access. Manage everyone else from Admin.') : 'Your user type and board views are set by a Super Admin.',
    onName: (e) => setProf({ name: (e && e.target ? e.target.value : '') }),
    onEmail: (e) => set({ prof: Object.assign({}, prof, { email: e && e.target ? e.target.value : '' }) }),
    onEmailBlur: () => { if (prof.email && prof.email !== me.email) A.changeEmail(prof.email); },
    segs: [
      { label: 'Theme', options: [['light', 'Light'], ['dark', 'Dark']].map((o) => ({ label: o[1], on: c.theme === o[0] ? 'true' : 'false', pick: () => { set({ theme: o[0] }); A.savePrefs({ theme: o[0] }); }, style: seg2(c.theme === o[0]) })) },
      { label: 'Row density', options: [['Comfortable', 'Comfortable'], ['Compact', 'Compact']].map((o) => ({ label: o[1], on: c.density === o[0] ? 'true' : 'false', pick: () => { set({ density: o[0] }); A.savePrefs({ density: o[0] }); }, style: seg2(c.density === o[0]) })) }
    ],
    views: VIEWS.map((v) => ({ value: v[0], label: v[1], on: s.view === v[0] })),
    onView: (e) => { const v = e && e.target ? e.target.value : 'table'; set({ view: v }); A.savePrefs({ view: v }); },
    notifs: [['digest', 'Daily email digest', 'A summary of your projects at 8 AM'], ['slack', 'Slack alerts', 'Mentions and status changes'], ['push', 'Desktop push', 'Alerts while the app is open'], ['quiet', 'Quiet hours', 'Mute alerts after 7 PM']].map((n) => Object.assign({ label: n[1], desc: n[2], toggle: () => { const next = Object.assign({}, myN, { [n[0]]: !myN[n[0]] }); set({ myN: next }); A.savePrefs({ myN: next }); } }, sw(myN[n[0]]))),
    mfa: Object.assign({ toggle: () => { set({ mfa: !mfaOn }); A.savePrefs({ mfa: !mfaOn }); } }, sw(mfaOn)),
    pwSub: me.pwChangedAt ? 'Last changed ' + relTime(me.pwChangedAt, now) : 'Send yourself a reset link',
    changePassword: () => A.resetPassword(),
    signOut: () => A.signOut('local'),
    signOutAll: () => A.signOut('global')
  };

  // ---------- Page header ----------
  const tagS = 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-3); font-size: 12px; font-weight: 600;';
  const P = {
    alerts: naTab === 'msgs'
      ? { eyebrow: 'Messages', title: 'Inbox', desc: 'Messages and mentions from connected tools.', note: mUnread ? mUnread + ' unread' : 'All read', ghost: mUnread ? 'Mark all read' : '', ghostPick: () => markMsgs(mList.filter((m) => m.isUnread).map((m) => m.id)) }
      : { eyebrow: isSponsor ? acctName : 'Notifications and activity', title: 'Inbox', desc: isSponsor ? 'Project updates, approval requests and idea discussions for ' + acctName + '.' : role === 'admin' ? 'Your notifications plus activity across the workspace.' : 'Your assignments, deadlines, revisions and comments.', note: unread ? unread + ' unread' : 'All read', ghost: unread && naTab === 'notif' ? 'Mark all read' : '', ghostPick: () => { const ids = nList.filter((n) => n.isUnread).map((n) => n.id); const m = Object.assign({}, nRead); ids.forEach((id) => { m[id] = true; }); set({ nRead: m }); A.markRead(ids); } },
    content: { eyebrow: 'Library', title: 'Content', desc: 'Everything published and scheduled, with performance and distribution status.', stats: contentStats, note: ct.syncNote, ghost: role === 'admin' ? ct.syncLabel : '', ghostPick: ct.syncPick },
    brand: { eyebrow: isSponsor ? 'Your brand' : role === 'admin' ? 'All brands' : 'Brands on your assignments', title: isSponsor ? 'My Brand' : 'Brand', desc: isSponsor ? 'Your assets, references and guidelines as the production team sees them.' : 'Logos, colors, type, voice and sponsor rules for each brand.', primary: role === 'admin' ? 'New brand' : '', primaryPick: openNewBrand, ghost: br.canEdit ? 'Edit brand' : '', ghostPick: openEdit },
    ideas: { eyebrow: role === 'admin' ? 'All brands' : isSponsor ? acctName : 'Your assigned brands', title: 'Ideas & Research', desc: role === 'admin' ? 'Ideas, scripts and research for every brand. Archive keeps history, delete is permanent.' : isSponsor ? 'Add, edit, discuss and archive ideas for ' + acctName + '.' : 'Create ideas and research for the brands you design for. Comment on any of them.', primary: c.ideas.canCreate ? 'New idea' : '', primaryPick: c.ideas.openNew, ghost: c.ideas.canResearch ? 'Research' : '', ghostPick: c.ideas.openResearch },
    settings: { eyebrow: 'Account', title: 'Settings', desc: 'Your profile, appearance, notifications and security.', note: 'Changes save automatically' }
  };
  const P0 = P[page] || P.alerts;
  const pg = {
    eyebrow: P0.eyebrow, title: P0.title, desc: P0.desc,
    hasTag: !!P0.tag, tag: P0.tag || '', tagStyle: tagS,
    hasNote: !!P0.note, note: P0.note || '',
    hasGhost: !!P0.ghost, ghost: P0.ghost || '', ghostPick: P0.ghostPick || (() => {}),
    hasPrimary: !!P0.primary, primary: P0.primary || '', primaryPick: P0.primaryPick || (() => {}),
    hasStats: !!P0.stats, stats: P0.stats || [],
    isAlerts: page === 'alerts', isContent: page === 'content', isBrand: page === 'brand', isSettings: page === 'settings', isIdeas: page === 'ideas'
  };
  return { chat: chat, nt: nt, ct: ct, br: br, pf: pf, pg: pg, unread: unread };
}

export { startOfDay };
