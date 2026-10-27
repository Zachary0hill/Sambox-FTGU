// Performance page: published content and its numbers from every connected content integration, over a date
// range compared with the period before it. Super Admin only, like Content.
//
// Each integration that brings back published posts with metrics has an adapter in ADAPTERS: where its rows live
// in the loaded data, and how one row maps onto the shared item shape below. The page lists every provider in the
// registry's 'content' group, so a new one shows up as a source as soon as it is added there; it gets numbers once
// it has an adapter.
//
// Item: { key, src, title, channel, chKey, service, at, url, thumb, reach, eng, engKnown, clicks }
//   reach  views on video, impressions (else views, else reach) on social. null when the network did not report it.
//   eng    likes + comments (+ shares, reposts, saves on social). engKnown is false when none of those came back.
// All numbers are lifetime totals as of the last sync, attributed to the day the post went out.
import { PROVIDERS } from '../integrations/registry';
import { MONTHS, relTime, fmtCount } from './model';

export const SERVICE_L = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', twitter: 'X', facebook: 'Facebook', youtube: 'YouTube', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest', mastodon: 'Mastodon', googlebusiness: 'Google Business', substack: 'Substack', startPage: 'Start Page', whatsapp: 'WhatsApp' };
const PLATFORM_L = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', facebook: 'Facebook', linkedin: 'LinkedIn', other: 'Other' };

const nz = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const sumKnown = (...xs) => { const k = xs.filter((x) => x !== null); return k.length ? k.reduce((a, x) => a + x, 0) : null; };
const https = (u) => (/^https:\/\/[^\s"'();\\]+$/.test(u || '') ? u : '');

const ADAPTERS = {
  youtube: {
    label: 'YouTube', kind: 'Videos', color: '#E5484D', pitch: 'Views, likes and comments on your public videos.',
    rows: (D) => (D.youtube || []).filter((v) => v.live_status !== 'upcoming'),
    item: (v, D) => {
      const ch = D.channels.find((x) => x.youtube_channel_id && x.youtube_channel_id === v.channel_id);
      const likes = nz(v.likes), comments = nz(v.comments);
      return {
        key: 'yt:' + v.video_id, src: 'youtube', title: v.title || 'Untitled video', channel: ch ? ch.name : v.channel_title || 'YouTube', chKey: 'yt:' + v.channel_id,
        service: 'YouTube', at: v.published_at, url: 'https://www.youtube.com/watch?v=' + v.video_id, thumb: https(v.thumbnail_url),
        reach: nz(v.views), eng: sumKnown(likes, comments) || 0, engKnown: likes !== null || comments !== null, clicks: null,
      };
    },
  },
  buffer: {
    label: 'Social', kind: 'Posts', color: '#4C7CF0', pitch: 'Impressions, engagement and clicks on social posts sent through Buffer.',
    rows: (D) => ((D.buffer && D.buffer.posts) || []).filter((p) => p.sent_at),
    item: (p, D) => {
      const ch = ((D.buffer && D.buffer.channels) || []).find((x) => x.channel_id === p.channel_id) || null;
      const service = SERVICE_L[p.service] || p.service || 'Social';
      const eng = sumKnown(...['reactions', 'comments', 'shares', 'reposts', 'saves'].map((k) => nz(p[k])));
      return {
        key: 'bf:' + p.post_id, src: 'buffer', title: String(p.text || '').split('\n')[0].slice(0, 140) || '(No text)',
        channel: ch ? ch.display_name || ch.name || service : 'Removed channel', chKey: 'bf:' + p.channel_id, service: service,
        at: p.sent_at, url: https(p.external_link), thumb: https(p.thumbnail_url),
        reach: nz(p.impressions) ?? nz(p.views) ?? nz(p.reach), eng: eng || 0, engKnown: eng !== null, clicks: nz(p.clicks),
      };
    },
  },
};

// Cards added by hand on the Content page (content_entries), for posts no integration brings in.
const MANUAL = {
  label: 'Added by hand', kind: 'Posts', color: '#8E8E93',
  rows: (D) => (D.contentEntries || []).filter((e) => e.status === 'published' && e.published_on),
  item: (e, D) => {
    const ch = D.channels.find((x) => x.id === e.channel_id);
    const likes = nz(e.likes), comments = nz(e.comments);
    return {
      key: 'm:' + e.id, src: 'manual', title: e.title, channel: ch ? ch.name : PLATFORM_L[e.platform] || 'Other', chKey: 'm:' + (e.channel_id || e.platform),
      service: PLATFORM_L[e.platform] || 'Other', at: e.published_on + 'T12:00:00', url: https(e.url), thumb: https(e.thumbnail_url),
      reach: nz(e.views), eng: sumKnown(likes, comments) || 0, engKnown: likes !== null || comments !== null, clicks: null,
    };
  },
};

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']];
const SORTS = [['reach', 'Reach'], ['eng', 'Engagements'], ['rate', 'Engagement rate'], ['date', 'Newest']];
const RATE_MIN = 100;

// Source, channel, range and sort are kept on this device until changed, so the page opens the way it was left.
const PREF_KEY = 'ftgu.performance';
let saved = null;
const prefs = () => {
  if (saved) return saved;
  try { saved = JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { saved = {}; }
  return saved;
};
const remember = (o) => {
  saved = Object.assign({}, prefs(), o);
  try { window.localStorage.setItem(PREF_KEY, JSON.stringify(saved)); } catch { /* private mode or storage off */ }
};

export function perfVals(c) {
  const s = c.s, set = c.set, D = c.D, A = c.A, now = c.now, hardBlock = c.hardBlock, solid = c.solid;

  // ---------- Sources ----------
  const integOf = (id) => (D.integrations || []).find((g) => g.provider === id) || null;
  const defs = PROVIDERS.filter((p) => p.group === 'content').map((p) => {
    const g = integOf(p.id), ad = ADAPTERS[p.id] || null;
    return { id: p.id, name: p.name, def: p, integ: g, on: !!g && g.status === 'connected', err: g && g.status === 'connected' ? g.last_error || '' : '', ad: ad, canSync: !!p.canSync };
  });
  const manualRows = MANUAL.rows(D);
  if (manualRows.length) defs.push({ id: 'manual', name: MANUAL.label, def: null, integ: null, on: true, err: '', ad: MANUAL, canSync: false, manual: true });
  const live = defs.filter((d) => d.on && d.ad);
  const all = [];
  live.forEach((d) => d.ad.rows(D).forEach((r) => { const it = d.ad.item(r, D), t = it.at ? new Date(it.at).getTime() : NaN; if (Number.isFinite(t)) all.push(Object.assign(it, { t: t })); }));

  // ---------- Filters ----------
  const pf = Object.assign({}, prefs(), Object.fromEntries(Object.entries({ range: s.pfRange, src: s.pfSrc, ch: s.pfCh, sort: s.pfSort }).filter((e) => e[1] !== undefined)));
  const days = RANGES.some((r) => r[0] === pf.range) ? pf.range : 30;
  const src = live.some((d) => d.id === pf.src) ? pf.src : 'all';
  const inSrc = all.filter((x) => src === 'all' || x.src === src);
  const chMap = {};
  inSrc.forEach((x) => { if (!chMap[x.chKey]) chMap[x.chKey] = { key: x.chKey, name: x.channel, src: x.src }; });
  const chList = Object.values(chMap).sort((a, b) => a.name.localeCompare(b.name));
  const ch = chMap[pf.ch] ? pf.ch : 'all';
  const items = inSrc.filter((x) => ch === 'all' || x.chKey === ch);

  // Calendar dates, not 24-hour steps, so a daylight saving change does not shift the edges by an hour.
  // Last 12 months is this month and the 11 before it, compared with the 12 before those.
  const y = now.getFullYear(), mo = now.getMonth(), dd = now.getDate();
  const at = (yy, mm, d) => new Date(yy, mm, d).getTime();
  const end = at(y, mo, dd + 1);
  const start = days === 365 ? at(y, mo - 11, 1) : at(y, mo, dd + 1 - days);
  const prevStart = days === 365 ? at(y, mo - 23, 1) : at(y, mo, dd + 1 - 2 * days);
  const cur = items.filter((x) => x.t >= start && x.t < end);
  const prev = items.filter((x) => x.t >= prevStart && x.t < start);
  const fmtDay = (t, yr) => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + (yr ? ', ' + d.getFullYear() : ''); };
  const span = (a, b) => fmtDay(a, new Date(a).getFullYear() !== new Date(b - 1).getFullYear()) + ' – ' + fmtDay(b - 1, true);

  // ---------- Totals ----------
  const roll = (list) => {
    const reachRows = list.filter((x) => x.reach !== null), rateRows = reachRows.filter((x) => x.reach > 0 && x.engKnown);
    const reach = reachRows.length ? reachRows.reduce((a, x) => a + x.reach, 0) : null;
    const eng = list.some((x) => x.engKnown) ? list.reduce((a, x) => a + x.eng, 0) : null;
    const rateReach = rateRows.reduce((a, x) => a + x.reach, 0);
    const clickRows = list.filter((x) => x.clicks !== null);
    return {
      posts: list.length, reach: reach, eng: eng, avg: reachRows.length ? reach / reachRows.length : null,
      rate: rateReach ? rateRows.reduce((a, x) => a + x.eng, 0) / rateReach * 100 : null,
      clicks: clickRows.length ? clickRows.reduce((a, x) => a + x.clicks, 0) : null,
    };
  };
  const R = roll(cur), P = roll(prev);
  // Oldest synced post in scope. Integrations backfill a limited history, so say when the comparison starts late.
  const oldest = items.reduce((a, x) => Math.min(a, x.t), Infinity);
  const historyNote = items.length && oldest > prevStart && oldest < start ? 'Earliest synced post is from ' + fmtDay(oldest, true) + ', so the previous period only counts posts from then on.' : '';
  const pctText = (v) => (v === null ? '–' : (v < 10 ? v.toFixed(1) : String(Math.round(v))) + '%');
  const cnt = (n) => (n === null ? '–' : fmtCount(Math.round(n)));
  const up = solid('green'), down = solid('red');
  const chipBase = 'display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; align-self: flex-start;';
  const delta = (a, b, points) => {
    let text, dir = 0;
    if (a === null || b === null) text = '–';
    else if (points) { const d = a - b; dir = Math.abs(d) < 0.05 ? 0 : d > 0 ? 1 : -1; text = (d > 0 ? '+' : '') + d.toFixed(1) + ' pts'; }
    else if (b === 0) { dir = a > 0 ? 1 : 0; text = a > 0 ? 'New' : '0.0%'; }
    else { const d = (a - b) / b * 100; dir = Math.abs(d) < 0.05 ? 0 : d > 0 ? 1 : -1; text = (d > 0 ? '+' : '') + (Math.abs(d) < 100 ? d.toFixed(1) : Math.round(d)) + '%'; }
    return {
      text: text, dir: dir, aria: dir > 0 ? 'Up ' + text.replace(/^\+/, '') : dir < 0 ? 'Down ' + text.replace(/^-/, '') : 'No change',
      style: chipBase + (dir > 0 ? ' background: ' + up[0] + '; color: ' + up[1] + ';' : dir < 0 ? ' background: ' + down[0] + '; color: ' + down[1] + ';' : ' background: var(--chip-2); color: var(--ink-3);'),
    };
  };
  const kpi = (label, value, d, help) => ({ label: label, value: value, delta: d, help: help });
  const kpis = [
    kpi('Published', String(R.posts), delta(R.posts, P.posts), 'Videos and posts that went out in this period.'),
    kpi('Reach', cnt(R.reach), delta(R.reach, P.reach), 'Views on videos, impressions on social posts.'),
    kpi('Avg. reach per post', cnt(R.avg), delta(R.avg, P.avg), 'Reach divided by posts that report it.'),
    kpi('Engagements', cnt(R.eng), delta(R.eng, P.eng), 'Likes, comments, shares, reposts and saves.'),
    kpi('Engagement rate', pctText(R.rate), delta(R.rate, P.rate, true), 'Engagements per reach, on posts that report both.'),
  ];
  if (R.clicks !== null || P.clicks !== null) kpis.push(kpi('Link clicks', cnt(R.clicks), delta(R.clicks, P.clicks), 'Clicks Buffer reports on social posts.'));

  // ---------- Reach over time, stacked by source ----------
  const bucketDays = days <= 30 ? 1 : days <= 90 ? 7 : 0;
  const buckets = [];
  const d0 = new Date(start);
  for (let i = 0; ; i++) {
    const a = bucketDays ? at(d0.getFullYear(), d0.getMonth(), d0.getDate() + i * bucketDays) : at(d0.getFullYear(), d0.getMonth() + i, 1);
    if (a >= end) break;
    const b = bucketDays ? at(d0.getFullYear(), d0.getMonth(), d0.getDate() + (i + 1) * bucketDays) : at(d0.getFullYear(), d0.getMonth() + i + 1, 1);
    buckets.push({ a: a, b: Math.min(b, end) });
  }
  const srcIds = live.map((d) => d.id).filter((id) => src === 'all' || id === src);
  const bars = buckets.map((bk) => {
    const inB = cur.filter((x) => x.t >= bk.a && x.t < bk.b);
    const parts = srcIds.map((id) => ({ id: id, v: inB.filter((x) => x.src === id).reduce((a, x) => a + (x.reach || 0), 0) }));
    return { a: bk.a, b: bk.b, posts: inB.length, total: parts.reduce((a, p) => a + p.v, 0), parts: parts };
  });
  const max = Math.max(1, ...bars.map((b) => b.total));
  const W = 720, H = 200, gap = bars.length > 40 ? 1 : 3, bw = (W - gap * (bars.length - 1)) / Math.max(1, bars.length);
  const colorOf = (id) => (defs.find((d) => d.id === id) || {}).ad?.color || '#8E8E93';
  const bucketLabel = (bk) => (bucketDays === 1 ? fmtDay(bk.a) : bucketDays === 7 ? 'Week of ' + fmtDay(bk.a) : MONTHS[new Date(bk.a).getMonth()] + ' ' + new Date(bk.a).getFullYear());
  const rects = [];
  bars.forEach((b, i) => {
    let y = H;
    b.parts.forEach((p) => {
      if (!p.v) return;
      const h = Math.max(2, p.v / max * (H - 8));
      y -= h;
      rects.push({ key: i + p.id, x: (i * (bw + gap)).toFixed(1), y: y.toFixed(1), w: Math.max(1, bw).toFixed(1), h: h.toFixed(1), fill: colorOf(p.id) });
    });
    if (!b.total) rects.push({ key: i + 'z', x: (i * (bw + gap)).toFixed(1), y: String(H - 2), w: Math.max(1, bw).toFixed(1), h: '2', fill: 'var(--line)' });
  });
  const hits = bars.map((b, i) => ({
    key: 'h' + i, x: (i * (bw + gap)).toFixed(1), w: Math.max(1, bw + gap).toFixed(1),
    title: bucketLabel(b) + ': ' + fmtCount(b.total) + ' reach from ' + b.posts + (b.posts === 1 ? ' post' : ' posts'),
  }));
  const tickIdx = bars.length <= 1 ? [0] : [0, Math.floor((bars.length - 1) / 2), bars.length - 1];
  const ticks = [...new Set(tickIdx)].map((i) => ({
    key: 't' + i, label: bucketDays === 0 ? MONTHS[new Date(bars[i].a).getMonth()] : fmtDay(bars[i].a),
    style: 'position: absolute; top: 0; font-size: 12px; color: var(--muted); white-space: nowrap; ' + (i === 0 ? 'left: 0;' : i === bars.length - 1 ? 'right: 0;' : 'left: 50%; transform: translateX(-50%);'),
  }));
  const peak = bars.reduce((a, b) => (b.total > a.total ? b : a), bars[0] || { total: 0 });
  const chart = {
    w: W, h: H, rects: rects, hits: hits, ticks: ticks, empty: !R.reach,
    yMax: fmtCount(max),
    aria: 'Reach by ' + (bucketDays === 1 ? 'day' : bucketDays === 7 ? 'week' : 'month') + ', ' + span(start, end) + '. Total ' + fmtCount(R.reach) + (peak && peak.total ? '. Highest: ' + bucketLabel(peak) + ' with ' + fmtCount(peak.total) + '.' : '.'),
    legend: srcIds.map((id) => ({ label: (defs.find((d) => d.id === id) || {}).name || id, swatch: 'width: 10px; height: 10px; flex: none; border-radius: 3px; background: ' + colorOf(id) + ';' })),
    caption: 'Lifetime reach of posts, grouped by the ' + (bucketDays === 1 ? 'day' : bucketDays === 7 ? 'week' : 'month') + ' they went out.',
  };

  // ---------- Stale data ----------
  // A source in view whose last sync failed, or that has not synced in two days, still counts with its old numbers.
  const STALE_MS = 2 * 86400000;
  const stale = live.filter((d) => !d.manual && srcIds.includes(d.id) && d.integ && (d.err || (d.integ.last_synced_at && now - new Date(d.integ.last_synced_at) > STALE_MS))).map((d) => {
    const last = d.integ.last_synced_at;
    const when = last ? relTime(last, now).replace(/^(Just|Yesterday|Today)/, (w) => w.toLowerCase()) : '';
    return d.err
      ? d.name + '\u2019s last sync failed. ' + (last ? 'Its numbers are from the last good sync, ' + when + '.' : 'It has no numbers yet.')
      : d.name + ' last synced ' + when + ', so its numbers may be behind.';
  });

  // ---------- Sources table ----------
  const openInteg = () => set({ nav: 'workspace', wsTab: 'integ' });
  const busy = s.integBusy || '';
  const syncOne = (d) => () => {
    if (busy) return;
    set({ integBusy: d.id + ':sync' });
    A.syncIntegration(d.integ).then(() => set({ integBusy: '' }));
  };
  // Sources and Channels cover the whole period, so the filters above do not hide the rows you would pick next.
  const period = all.filter((x) => x.t >= start && x.t < end);
  const sources = defs.map((d) => {
    const r = roll(period.filter((x) => x.src === d.id));
    const synced = d.integ && d.integ.last_synced_at;
    const status = d.manual ? 'Content page' : !d.on ? 'Not connected' : d.err ? 'Needs attention' : !d.ad ? 'No metrics yet' : 'Connected';
    return {
      name: d.name, kind: d.ad ? d.ad.kind : '', on: d.on, swatch: 'width: 10px; height: 10px; flex: none; border-radius: 3px; background: ' + (d.ad && d.on ? d.ad.color : 'var(--border-strong)') + ';',
      status: status, statusStyle: hardBlock(d.manual ? null : !d.on ? null : d.err ? solid('red') : solid('green'), 22) + ' font-size: 11px; padding: 0 8px;',
      sub: d.manual ? 'Cards added on the Content page' : !d.on ? (d.ad && d.ad.pitch) || d.def.description || 'Connect it in Workspace Settings.' : d.err ? d.err : !d.ad ? 'Connected. Its numbers are not on this page yet.' : synced ? 'Synced ' + relTime(synced, now) : 'Not synced yet',
      hasErr: !!d.err,
      stats: d.on && d.ad ? [String(r.posts), cnt(r.reach), cnt(r.eng), pctText(r.rate)] : ['–', '–', '–', '–'],
      action: d.manual ? '' : !d.on || d.err ? (d.on ? 'Fix' : 'Connect') : d.canSync ? (busy === d.id + ':sync' ? 'Syncing…' : 'Sync') : '',
      act: !d.on || d.err ? openInteg : syncOne(d), actDisabled: !!busy && d.on && !d.err,
      actAria: (!d.on ? 'Connect ' : d.err ? 'Fix ' : 'Sync ') + d.name,
    };
  });

  // ---------- Channels ----------
  const pickCh = (k) => { remember({ ch: k }); set({ pfCh: k }); };
  const byCh = {};
  period.filter((x) => src === 'all' || x.src === src).forEach((x) => { (byCh[x.chKey] = byCh[x.chKey] || []).push(x); });
  const srcName = (id) => (defs.find((d) => d.id === id) || {}).name || id;
  const channels = Object.keys(byCh).map((k) => ({ k: k, x: byCh[k][0], r: roll(byCh[k]) })).sort((a, b) => (b.r.reach || 0) - (a.r.reach || 0)).map((o) => ({
    name: o.x.channel, sub: srcName(o.x.src) + (o.x.src === 'buffer' ? '  ·  ' + o.x.service : ''), swatch: 'width: 10px; height: 10px; flex: none; border-radius: 3px; background: ' + colorOf(o.x.src) + ';',
    stats: [String(o.r.posts), cnt(o.r.reach), cnt(o.r.eng), pctText(o.r.rate)],
    on: ch === o.k, pressed: ch === o.k ? 'true' : 'false', pick: () => pickCh(ch === o.k ? 'all' : o.k),
    aria: (ch === o.k ? 'Show all channels' : 'Show only ' + o.x.channel),
  }));

  // ---------- Top content ----------
  const sort = SORTS.some((x) => x[0] === pf.sort) ? pf.sort : 'reach';
  const rateOf = (x) => (x.reach > 0 && x.engKnown ? x.eng / x.reach * 100 : null);
  // Ranking by rate skips posts under RATE_MIN reach (they sort after), so a video with 3 views and 2 likes is not first.
  const rateRank = (x) => (x.reach >= RATE_MIN ? rateOf(x) ?? -1 : -2 + (rateOf(x) ?? 0) / 1e6);
  const sorted = cur.slice().sort((a, b) => sort === 'date' ? b.t - a.t : sort === 'eng' ? b.eng - a.eng : sort === 'rate' ? rateRank(b) - rateRank(a) : (b.reach ?? -1) - (a.reach ?? -1));
  const cap = s.pfAll ? sorted.length : 10;
  const top = sorted.slice(0, cap).map((x, i) => ({
    key: x.key, rank: String(i + 1), title: x.title, meta: x.channel + '  ·  ' + x.service, date: fmtDay(x.t, new Date(x.t).getFullYear() !== now.getFullYear()),
    hasThumb: !!x.thumb, thumb: x.thumb, thumbStyle: 'width: ' + (x.src === 'youtube' ? 64 : 40) + 'px; height: 36px; flex: none; border-radius: 8px; object-fit: cover; background: var(--chip-2);',
    noThumbStyle: 'width: 40px; height: 36px; flex: none; border-radius: 8px; background: ' + colorOf(x.src) + '; opacity: 0.85;',
    stats: [cnt(x.reach), x.engKnown ? cnt(x.eng) : '–', pctText(rateOf(x))],
    hasUrl: !!x.url, url: x.url, linkAria: 'Open ' + x.title + ' on ' + x.service,
  }));
  const cell = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
  const exportRows = () => A.exportCsv([['Title', 'Source', 'Channel', 'Network', 'Published', 'Reach', 'Engagements', 'Engagement rate %', 'Link clicks', 'Link']]
    .concat(sorted.map((x) => [cell(x.title), srcName(x.src), cell(x.channel), x.service, new Date(x.t).toISOString().slice(0, 10), x.reach ?? '', x.engKnown ? x.eng : '', rateOf(x) === null ? '' : rateOf(x).toFixed(2), x.clicks ?? '', x.url])), 'performance');

  // ---------- Header: sync every connected content integration ----------
  const syncable = defs.filter((d) => d.on && d.canSync);
  const syncTimes = syncable.map((d) => d.integ.last_synced_at).filter(Boolean).sort();
  const neverSynced = syncable.filter((d) => !d.integ.last_synced_at).map((d) => d.name);
  const syncAll = async () => {
    if (!syncable.length) return openInteg();
    if (busy) return;
    set({ integBusy: 'perf:sync' });
    const res = [];
    for (const d of syncable) res.push(Object.assign({ name: d.name }, await A.syncIntegration(d.integ, { quiet: true })));
    await A.reload();
    set({ integBusy: '' });
    const ok = res.filter((r) => r.ok).map((r) => r.name), bad = res.filter((r) => !r.ok);
    A.toast([ok.length ? 'Synced ' + ok.join(' and ') + '.' : '', ...bad.map((r) => r.name + ' did not sync: ' + r.msg)].filter(Boolean).join(' '));
  };
  const sel = 'min-height: 44px; padding: 0 36px 0 14px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 12px; background: var(--surface) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M4 6l4 4 4-4%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%271.8%27 stroke-linecap=%27round%27/%3E%3C/svg%3E") no-repeat right 12px center; color: var(--ink); font-size: 14px; appearance: none; -webkit-appearance: none; cursor: pointer; max-width: 100%;';
  const val = (e) => (e && e.target ? e.target.value : '');

  return {
    hasAny: live.length > 0, connectedCount: defs.filter((d) => d.on && !d.manual).length,
    openInteg: openInteg,
    emptyText: 'Connect YouTube or Buffer in Workspace Settings and sync once. Videos and posts they bring in, with their views, impressions and engagement, show up here.',
    selStyle: sel,
    srcOpts: [['all', 'All sources']].concat(live.map((d) => [d.id, d.name])).map((o) => ({ value: o[0], label: o[1] })), src: src,
    onSrc: (e) => { remember({ src: val(e), ch: 'all' }); set({ pfSrc: val(e), pfCh: 'all' }); },
    chOpts: [['all', 'All channels']].concat(chList.map((x) => [x.key, x.name + (src === 'all' ? ' (' + srcName(x.src) + ')' : '')])).map((o) => ({ value: o[0], label: o[1] })), ch: ch,
    onCh: (e) => pickCh(val(e)),
    rangeOpts: RANGES.map((r) => ({ value: String(r[0]), label: r[1] })), range: String(days),
    onRange: (e) => { const n = Number(val(e)) || 30; remember({ range: n }); set({ pfRange: n }); },
    periodText: span(start, end) + ' compared to ' + span(prevStart, start), historyNote: historyNote,
    hasStale: stale.length > 0, staleText: stale.join(' '), staleFix: live.some((d) => d.err && srcIds.includes(d.id)),
    kpis: kpis, chart: chart, sources: sources, channels: channels, noChannels: channels.length === 0,
    top: top, noTop: top.length === 0, topEmpty: items.length ? 'Nothing went out in this period. Try a longer range.' : 'Nothing synced from these sources yet.',
    sortOpts: SORTS.map((x) => ({ value: x[0], label: x[1] })), sort: sort, onSort: (e) => { remember({ sort: val(e) }); set({ pfSort: val(e) }); },
    hasMore: sorted.length > 10, moreLabel: s.pfAll ? 'Show top 10' : 'Show all ' + sorted.length, toggleMore: () => set({ pfAll: !s.pfAll }),
    canExport: sorted.length > 0, exportCsv: exportRows,
    syncNote: neverSynced.length ? neverSynced.join(' and ') + ' not synced yet' : syncTimes.length ? 'Updated ' + relTime(syncTimes[0], now).replace(/^(Just|Yesterday|Today)/, (w) => w.toLowerCase()) : syncable.length ? 'Not synced yet' : '',
    syncLabel: !syncable.length ? (live.length ? 'Connect integrations' : '') : busy === 'perf:sync' ? 'Syncing…' : 'Sync now',
    syncPick: syncAll,
  };
}
