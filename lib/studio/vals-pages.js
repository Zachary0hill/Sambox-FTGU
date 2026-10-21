// Workspace pages: Daily, Inbox, Content, Brand, Settings. Ported from the design's pagesVals().
import { relTime, dayGroup, fmtCount, MONTHS, startOfDay, first } from './model';

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
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString('en-US', { month: 'long' });
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
      const nx = scoped.find((r) => r.status === 'Scripting') || scoped.find((r) => r.status === 'Filming') || scoped[0];
      if (!nx) return { text: 'There is no project to script in your view.', items: [] };
      return {
        text: 'Draft outline for ' + nx.title + '.',
        items: [statusItem(nx, 'Film ' + nx.film + '  ·  Pub ' + nx.pub)],
        bullets: [
          'Hook, first 15 seconds: open on the end result, then the one question this video answers.',
          'Beat 1: the setup and why it matters to a store owner right now.',
          'Beat 2: the walkthrough, one step per screen, under 90 seconds each.',
          'Beat 3: the common mistakes, each with the fix and one real example.',
          nx.sponsor ? 'Sponsor read for ' + nx.sponsor + ' lands after the first payoff, 60 seconds max.' : 'Mention the free guide once, after the first payoff.',
          'CTA: the next video, plus the guide link in the pinned comment.',
          'Caption: lead with the outcome, add three search phrases, close with the guide link.'
        ],
        foot: 'Ask me to expand any beat into lines.'
      };
    }
    if (/strateg|idea|content|plan for|november|december|january/.test(t)) {
      const ty = {};
      scoped.forEach((r) => { ty[r.type] = (ty[r.type] || 0) + 1; });
      const needClips = allRows.filter((r) => r.status === 'Live' && r.clipping !== 'Done').length;
      const mainCh = (D.channels.find((x) => x.is_internal) || D.channels[0] || { name: 'the main channel' }).name;
      return {
        text: 'Here is a content plan built from what is already on the board.',
        items: [],
        bullets: [
          'Longform: ' + (ty['YouTube Video'] || 0) + ' in the pipeline. Hold one upload per week on ' + mainCh + '.',
          'Shortform: ' + (ty['Shortform'] || 0) + ' in the pipeline. Cut three clips from every longform that goes Live.',
          'Live: ' + (ty['YouTube Live'] || 0) + ' on the board. Use each stream to tease the next longform.',
          'Distribution: ' + needClips + ' live video' + (needClips === 1 ? '' : 's') + ' still need clipping.',
          'Sponsors: ' + pend.length + ' approval' + (pend.length === 1 ? '' : 's') + ' open. Close them before you book new deals.'
        ],
        foot: 'Want this as a calendar for ' + nextMonth + '?'
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

  const chats = {};
  const pendingChats = s.chatsLocal || {};
  D.threads.forEach((t) => { chats[t.id] = { id: t.id, title: t.title, group: { today: 'Today', yesterday: 'Yesterday', earlier: 'Older' }[dayGroup(t.at, now)], q: t.q.slice() }; });
  Object.keys(pendingChats).forEach((id) => { chats[id] = Object.assign({}, chats[id] || {}, pendingChats[id]); });
  const order = Object.keys(pendingChats).filter((id) => !D.threads.some((t) => t.id === id)).concat(D.threads.map((t) => t.id));
  const cq = (s.chatQ || '').trim().toLowerCase();
  const curId = s.chatId && chats[s.chatId] ? s.chatId : '';
  const groups = ['Today', 'Yesterday', 'Older'].map((g) => ({
    title: g,
    items: order.map((id) => chats[id]).filter((ch) => ch && ch.group === g && (!cq || ch.title.toLowerCase().includes(cq))).map((ch) => {
      const on = ch.id === curId;
      return {
        title: ch.title, preview: ch.q.length ? replyFor(ch.q[ch.q.length - 1]).text : '', current: on ? 'page' : 'false',
        pick: () => set({ chatId: ch.id, chatDraft: '' }),
        style: 'display: flex; align-items: flex-start; gap: 10px; width: 100%; min-height: 56px; padding: 8px 12px; box-sizing: border-box; border: 0; border-radius: 12px; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.3; color: var(--ink-4); background: ' + (on ? 'var(--chip-2)' : 'transparent') + ';'
      };
    })
  })).filter((g) => g.items.length > 0);
  const send = (txt) => {
    const t = String(txt == null ? (s.chatDraft || '') : txt).trim();
    if (!t) return;
    const local = Object.assign({}, s.chatsLocal || {});
    if (curId) {
      local[curId] = Object.assign({}, chats[curId], { q: chats[curId].q.concat([t]) });
      set({ chatsLocal: local, chatDraft: '' });
      A.sendChat(curId, null, t);
    } else {
      const id = 'local-' + Date.now();
      const title = t.length > 44 ? t.slice(0, 44) + '…' : t;
      local[id] = { id: id, title: title, group: 'Today', q: [t] };
      set({ chatsLocal: local, chatId: id, chatDraft: '' });
      A.sendChat(null, title, t).then((realId) => {
        if (realId) set((cur) => { const l = Object.assign({}, cur.chatsLocal || {}); delete l[id]; return { chatsLocal: l, chatId: cur.chatId === id ? realId : cur.chatId }; });
      });
    }
  };
  const msgs = [];
  if (curId) chats[curId].q.forEach((q) => {
    msgs.push({ isUser: true, isAi: false, text: q, wrapStyle: 'display: flex; justify-content: flex-end;' });
    const rp = replyFor(q);
    const items = rp.items || [], bullets = rp.bullets || [];
    msgs.push({ isUser: false, isAi: true, text: rp.text, items: items, hasItems: items.length > 0, bullets: bullets, hasBullets: bullets.length > 0, foot: rp.foot || '', hasFoot: !!rp.foot, wrapStyle: 'display: flex; align-items: flex-start; gap: 12px;' });
  });

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
  const rv = reachRows.length > 1 ? reachRows.map((r) => (accum += Number(metricOf[r.id].views || 0))) : [0, reachTotal || 1];
  const mn = Math.min.apply(null, rv), mx = Math.max.apply(null, rv);
  const spark = rv.map((v, i) => (i * 120 / (rv.length - 1)).toFixed(1) + ',' + (22 - (v - mn) / Math.max(1, mx - mn) * 20).toFixed(1)).join(' ');
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
    card({ label: 'Audience reach', value: reach[0], sub: reach[2], icon: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', iconStyle: ico('violet'), isSpark: true, spark: spark, sparkColor: solid('violet')[0] }, 3)
  ];
  const Q = isSponsor
    ? [['Project update', 'Give me a project update', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', 'green'], ['My approvals', 'Which sponsor approvals are open?', 'M20 6 9 17l-5-5', 'violet'], ['Plan my week', 'Plan my week', 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18', 'amber'], ['Content strategy', 'Give me a content strategy', 'M3 3v18h18M7 14l4-4 4 4 5-5', 'blue']]
    : [['Project update', 'Give me a project update', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', 'green'], ['What is late?', 'What is late?', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', 'red'], ['Plan my week', 'Plan my week', 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18', 'amber'], ['Script & caption', 'Write a script outline and caption for the next shoot', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 'violet']];
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
    sub: 'Ask about projects, deadlines, approvals or what to post next. Answers use the board data for your view.',
    cards: kcards, quick: quick, attn: attn, hasAttn: attn.length > 0,
    placeholder: 'Ask anything about your projects',
    draft: draft,
    onDraft: (e) => set({ chatDraft: e && e.target ? e.target.value : '' }),
    onKey: (e) => { if (e && e.key === 'Enter') { if (e.preventDefault) e.preventDefault(); send(e.target ? e.target.value : null); } },
    send: () => send(),
    scope: 'Board data  ·  ' + (role === 'admin' ? 'All projects' : c.scopeName),
    scopeChip: 'display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 12px; border-radius: 999px; background: var(--chip); font-size: 13px; font-weight: 600; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;',
    scopeDot: 'width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + solid('green')[0] + ';',
    composerStyle: 'position: relative; width: 100%; max-width: 760px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 14px 12px 10px 18px; border: 1px solid var(--border); border-radius: 22px; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08);',
    inputStyle: 'width: 100%; min-height: 40px; box-sizing: border-box; padding: 0; border: 0; background: transparent; font-size: 16px; color: var(--ink);',
    iconBtn: 'width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;',
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
  const naTab = s.naTab || 'notif';
  const modeBtn = (on) => 'min-height: 36px; padding: 0 12px 0 14px; border: 0; border-radius: 10px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);');
  const nt = {
    modes: [['notif', 'Notifications', unread], ['activity', 'Activity', acts.length]].map((m) => ({ label: m[1], count: String(m[2]), badge: GRAYP, selected: naTab === m[0] ? 'true' : 'false', pick: () => set({ naTab: m[0] }), style: modeBtn(naTab === m[0]) })),
    isNotif: naTab === 'notif', isActivity: naTab === 'activity',
    tabs: nTabs, groups: nGroups, empty: nGroups.length === 0,
    actGroups: actGroups, actEmpty: actGroups.length === 0,
    actNote: role === 'admin' ? 'Changes on projects and ideas across the workspace.' : isSponsor ? 'Updates on ' + acctName + ' projects and ideas.' : 'Changes on the projects and ideas you are assigned to.',
    showAudit: role === 'admin', goLogs: () => set({ nav: 'logs' })
  };

  // ---------- Content ----------
  const DOTC = dark ? { 'Done': '#3FCF73', 'Drafted': '#5B8BFF', 'Ongoing': '#F5B83D', 'Not Yet': '#4A4C52' } : { 'Done': '#3DB46D', 'Drafted': '#4C7CF0', 'Ongoing': '#E0A526', 'Not Yet': '#C4C4C4' };
  const mOf = (id) => { const m = metricOf[id]; return m ? [fmtCount(Number(m.views)), fmtCount(Number(m.likes)), Math.round(Number(m.retention_pct)) + '%'] : null; };
  const toC = (r, onBoard) => ({ id: r.id, title: r.title, channel: r.channel, type: r.type, pub: r.pub, live: r.status === 'Live', m: mOf(r.id), dist: { clipping: r.clipping || 'Not Yet', newsletter: r.newsletter || 'Not Yet', community: r.community || 'Not Yet', distribute: r.distribute || 'Not Yet' }, job: onBoard ? r.job : '', linkUrl: r.linkUrl });
  const boardC = scoped.filter((r) => r.status === 'Live' || r.status === 'Scheduled').map((r) => toC(r, true));
  const catC = c.catalogRows.map((r) => toC(r, false));
  const allC = boardC.concat(catC);
  const cTab = s.cTab || 'all';
  const cCh = s.cCh || 'all';
  const cShown = allC.filter((x) => (cTab === 'all' || x.type === cTab) && (cCh === 'all' || x.channel === cCh));
  const cTabs = [['all', 'All', null], ['YouTube Video', 'Longform', 'YouTube Video'], ['Shortform', 'Shortform', 'Shortform'], ['YouTube Live', 'Live', 'YouTube Live']].map((t) => Object.assign(tab(t[1], t[0] === 'all' ? allC.length : allC.filter((x) => x.type === t[0]).length, cTab === t[0], () => set({ cTab: t[0] })), { swatch: t[2] ? 'width: 10px; height: 10px; flex: none; background: ' + TYPEFILL[t[2]][0] + ';' : 'display: none;' }));
  const items = cShown.map((x) => {
    const f = TYPEFILL[x.type] || ['#6B6B6B', '#FFFFFF'];
    const st = x.live ? (x.job ? 'Live' : 'Published') : 'Scheduled';
    return {
      title: x.title, type: x.type, thumbText: x.title,
      meta: x.channel + '  ·  ' + (x.live ? 'Published ' : 'Scheduled for ') + x.pub,
      thumbStyle: 'position: relative; aspect-ratio: 16 / 9; display: flex; flex-direction: column; justify-content: flex-end; padding: 44px 16px 16px; box-sizing: border-box; background: ' + f[0] + '; color: ' + f[1] + ';',
      typeStyle: 'position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: ' + f[1] + '; color: ' + f[0] + ';',
      state: st,
      stateStyle: 'position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 700; background: var(--surface); color: var(--ink);',
      hasMetrics: !!x.m, noMetrics: !x.m,
      metrics: x.m ? [{ label: 'Views', value: x.m[0] }, { label: 'Likes', value: x.m[1] }, { label: 'Avg view', value: x.m[2] }] : [],
      pendingText: (x.live ? 'Published ' : 'Goes live ') + x.pub + '. Metrics show up 24 hours after publish.',
      dist: [['clipping', 'Clipping'], ['newsletter', 'Newsletter'], ['community', 'Community'], ['distribute', 'Distribute']].map((d) => ({ label: d[1], state: ': ' + x.dist[d[0]], dotStyle: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + (DOTC[x.dist[d[0]]] || '#C4C4C4') + ';' })),
      linkText: x.live ? 'Watch on YouTube' : 'Preview draft', href: x.linkUrl || '',
      hasProject: !!x.job, open: x.job ? openProj(x.job) : () => {}, aria: 'Open project ' + x.title
    };
  });
  const withM = cShown.filter((x) => x.m);
  const ct = {
    tabs: cTabs, items: items, empty: items.length === 0,
    channels: [['all', 'All channels']].concat(D.channels.map((x) => [x.name, x.name])).map((o) => ({ value: o[0], label: o[1], on: o[0] === cCh })),
    onChannel: (e) => set({ cCh: e && e.target ? e.target.value : 'all' }),
    linkStyle: 'display: inline-flex; align-items: center; gap: 6px; min-height: 36px; color: var(--link); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap;',
    openBtn: 'min-height: 36px; margin-left: auto; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;'
  };
  const sumViews = withM.reduce((a, x) => a + Number(metricOf[x.id].views || 0), 0);
  const contentStats = [
    { label: 'Views, all time', value: fmtCount(sumViews), sub: withM.length + ' published videos in view' },
    { label: 'Avg view', value: withM.length ? Math.round(withM.reduce((a, x) => a + parseFloat(x.m[2]), 0) / withM.length) + '%' : '0%', sub: 'Share of each video watched' },
    { label: 'Scheduled', value: String(cShown.filter((x) => !x.live).length), sub: 'Waiting to publish' },
    { label: 'Need clipping', value: String(cShown.filter((x) => x.live && x.dist.clipping !== 'Done').length), sub: 'Live without short clips' }
  ];

  // ---------- Brand ----------
  const BRANDS = c.authBrands;
  const kitOf = {};
  D.brands.forEach((b) => { kitOf[b.name] = b; });
  const isChannel = (b) => !!kitOf[b] && kitOf[b].kind === 'channel';
  const bCh = BRANDS.indexOf(s.brCh) >= 0 ? s.brCh : (BRANDS[0] || '');
  const kb = kitOf[bCh] || { colors: [], fonts: [], tone: [], dos: [], donts: [], sections: [], assets: [] };
  const secs = kb.sections || [];
  const K = isChannel(bCh) ? {
    colors: kb.colors, fonts: kb.fonts, tone: kb.tone, dos: kb.dos, donts: kb.donts,
    r2: secs[0] || ['Thumbnails', []], r3: secs[1] || ['Sponsor reads', []]
  } : {
    colors: kb.colors, fonts: kb.fonts && kb.fonts.length ? kb.fonts : [['Inter', 'On screen text and lower thirds for the read', "'Inter', sans-serif", 600]],
    tone: kb.tone, dos: kb.dos, donts: kb.donts,
    r2: secs[0] || ['Disclosure', ['Say sponsored by in the read itself.', 'Add #ad to every social cut.', 'The pinned comment carries the tracked link.']],
    r3: secs[1] || ['Approval', ['Send the draft read for approval before Sponsor Review.', 'Changes requested go back to the editor the same day.', 'Final approval unlocks Scheduled.']]
  };
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
  const br = {
    hasPicker: BRANDS.length > 1,
    groups: [['Channels', BRANDS.filter(isChannel)], ['Sponsors', BRANDS.filter((b) => !isChannel(b))]].filter((g) => g[1].length).map((g) => ({ title: g[0], items: g[1].map(pickerItem) })),
    name: bCh || 'No brands yet', initials: ini(bCh || '-'), tileLg: c.brandTile(48),
    kind: isChannel(bCh) ? 'Channel' : 'Sponsor', kindStyle: hardBlock(solid(isChannel(bCh) ? 'blue' : 'amber'), 26),
    sub: (isChannel(bCh) ? 'Channel brand' : 'Sponsor brand') + '  ·  ' + brandRows(bCh).length + ' linked projects in your view',
    readOnly: readOnly,
    logos: [['[Primary logo]', false], ['[Icon mark]', false], ['[Logo on dark]', true]].map((l) => ({ label: l[0], style: 'aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; border: 1.5px dashed ' + (l[1] ? 'transparent' : 'var(--border-strong)') + '; background: ' + (l[1] ? 'var(--inv)' : 'var(--surface-2)') + '; color: ' + (l[1] ? 'var(--inv-ink)' : 'var(--muted)') + ';' })),
    logoNote: readOnly ? 'Placeholders until final files are uploaded by a Super Admin.' : 'Placeholders. Upload final logo files to replace them.',
    fonts: K.fonts.map((f) => ({ name: f[0], use: f[1], sampleStyle: 'width: 72px; flex: none; font-family: ' + f[2] + '; font-weight: ' + f[3] + '; font-size: 40px; line-height: 1; letter-spacing: -0.02em; color: var(--ink);' })),
    colors: K.colors.map((cl) => ({
      name: cl[0], hex: cl[1], aria: 'Copy ' + cl[0] + ' ' + cl[1], btn: s.copied === cl[1] ? 'Copied' : 'Copy',
      swatch: 'display: block; height: 72px; background: ' + cl[1] + ';' + (lumOf(cl[1]) > 0.85 ? ' border-bottom: 1px solid var(--line);' : ''),
      copy: () => { try { if (navigator.clipboard) navigator.clipboard.writeText(cl[1]); } catch (e) {} set({ copied: cl[1] }); }
    })),
    tagStyle: 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600;',
    rules: [
      { title: isChannel(bCh) ? 'Voice' : 'Talking points', hasTags: true, tags: K.tone, items: K.dos.map((t) => ({ text: t, mark: '+', markStyle: mark(true) })).concat(K.donts.map((t) => ({ text: t, mark: '−', markStyle: mark(false) }))) },
      { title: K.r2[0], hasTags: false, tags: [], items: K.r2[1].map((t) => ({ text: t, mark: '+', markStyle: mark(true) })) },
      { title: K.r3[0], hasTags: false, tags: [], items: K.r3[1].map((t) => ({ text: t, mark: '+', markStyle: mark(true) })) }
    ],
    refs: brandRows(bCh).slice(0, 4).map((r) => ({ name: r.title, meta: r.status + '  ·  Pub ' + r.pub, isProject: true, isLink: false, open: openProj(r.job), aria: 'Open ' + r.title }))
      .concat([['Brand website', 'Official site and press kit'], ['Approved examples', 'Past videos that passed review']].map((x) => ({ name: x[0], meta: x[1], isProject: false, isLink: true, open: () => {}, aria: 'View ' + x[0] }))),
    assets: ((kb.assets && kb.assets.length) ? kb.assets : (isChannel(bCh) ? [['Brand guidelines', 'PDF  ·  12 pages'], ['Thumbnail template', 'PSD  ·  Layered'], ['Lower thirds pack', 'MOGRT  ·  6 styles'], ['End screen template', 'MP4 and PSD']] : [['Logo pack', 'SVG and PNG'], ['Product b-roll', 'MP4  ·  4K'], ['Read script and codes', 'PDF  ·  1 page']])).map((a) => ({ name: a[0], meta: a[1], aria: 'Download ' + a[0] }))
  };

  // ---------- Settings ----------
  const prof = Object.assign({ name: me.fullName, email: me.email }, s.prof || {});
  const setProf = (patch) => { set({ prof: Object.assign({}, prof, patch) }); if (patch.name !== undefined) A.saveProfileName(patch.name); };
  const R = ROLES.find((x) => x.id === role) || ROLES[0];
  const prefs = me.prefs || {};
  const myN = Object.assign({ digest: true, slack: true, push: false, quiet: true }, prefs.myN || {}, s.myN || {});
  const mfaOn = s.mfa === undefined ? (prefs.mfa === undefined ? true : !!prefs.mfa) : !!s.mfa;
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
    signOutAll: () => A.signOut('global')
  };

  // ---------- Page header ----------
  const tagS = 'display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip-2); color: var(--ink-3); font-size: 12px; font-weight: 600;';
  const P = {
    alerts: { eyebrow: isSponsor ? acctName : 'Notifications and activity', title: 'Inbox', desc: isSponsor ? 'Project updates, approval requests and idea discussions for ' + acctName + '.' : role === 'admin' ? 'Your notifications plus activity across the workspace.' : 'Your assignments, deadlines, revisions and comments.', note: unread ? unread + ' unread' : 'All read', ghost: unread && naTab === 'notif' ? 'Mark all read' : '', ghostPick: () => { const ids = nList.filter((n) => n.isUnread).map((n) => n.id); const m = Object.assign({}, nRead); ids.forEach((id) => { m[id] = true; }); set({ nRead: m }); A.markRead(ids); } },
    content: { eyebrow: 'Library', title: 'Content', desc: 'Everything published and scheduled, with performance and distribution status.', tag: 'Sample metrics', stats: contentStats },
    brand: { eyebrow: isSponsor ? 'Your brand' : role === 'admin' ? 'All brands' : 'Brands on your assignments', title: isSponsor ? 'My Brand' : 'Brand', desc: isSponsor ? 'Your assets, references and guidelines as the production team sees them.' : 'Logos, colors, type, voice and sponsor rules for each brand.', ghost: '', ghostPick: () => {} },
    ideas: { eyebrow: role === 'admin' ? 'All brands' : isSponsor ? acctName : 'Your assigned brands', title: 'Ideas & Research', desc: role === 'admin' ? 'Ideas, scripts and research for every brand. Archive keeps history, delete is permanent.' : isSponsor ? 'Add, edit, discuss and archive ideas for ' + acctName + '.' : 'Create ideas and research for the brands you design for. Comment on any of them.', primary: c.ideas.canCreate ? 'New idea' : '', primaryPick: c.ideas.openNew },
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
