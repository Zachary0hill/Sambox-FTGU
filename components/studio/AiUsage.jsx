'use client';
// Workspace Settings > AI usage (Super Admin only). Requests, tokens and estimated cost of every AI call the board makes
// (Daily assistant answers, research drafts, idea cover images), from /api/ai/usage. Costs are estimates priced
// from lib/ai/pricing.ts or the prices a Super Admin sets per model here; the provider's own billing page is the bill.
import { useEffect, useState } from 'react';
import { css } from '@/lib/studio/css';

const panel = 'display: flex; flex-direction: column; gap: 16px; padding: 20px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); min-width: 0;';
const h2 = 'margin: 0; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink);';
const sub = 'margin: 0; font-size: 13px; color: var(--muted);';
const statCard = 'display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); min-width: 0;';
const big = 'font-family: var(--font-title); font-weight: var(--weight-black); font-size: 26px; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--ink);';
const seg = 'display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; background: var(--chip); border-radius: 12px;';
const segBtn = (on) => 'min-height: 36px; padding: 0 12px; border: 0; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);');
const ghost = 'min-height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;';
const primary = 'min-height: 36px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;';
const th = 'text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--muted-2); border-bottom: 1px solid var(--line); white-space: nowrap;';
const td = 'padding: 10px 12px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; vertical-align: top;';
const num = ' text-align: right; white-space: nowrap;';
const rowHead = td + ' text-align: left; font-weight: 600; color: var(--ink);';
const input = 'width: 96px; min-height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13px;';
const tag = (tone) => 'display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; ' +
  (tone === 'warn' ? 'background: var(--amber-soft, #FFF4D6); color: var(--amber-ink, #7A5200);' : 'background: var(--chip-2); color: var(--ink-3);');

const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['month', 'This month']];
const FEATURES = { assistant: 'Daily assistant', research: 'Research drafts', cover: 'Idea covers', other: 'Other' };

const usd = (v) => {
  if (!v) return '$0.00';
  if (v < 0.01) return '<$0.01';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const compact = (v) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);
const whole = (v) => (v || 0).toLocaleString('en-US');
const inTok = (b) => b.input + b.cacheRead + b.cacheWrite;
const costCell = (b) => usd(b.cost) + (b.unpriced ? ' +' : '');
const shortDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const perM = (v) => (v == null ? '—' : '$' + (+v.toFixed(4)) + '');

function Stat({ label, value, note }) {
  return (
    <div style={css(statCard)}>
      <span style={css('font-size: 13px; font-weight: 600; color: var(--muted);')}>{label}</span>
      <span style={css(big)}>{value}</span>
      {note ? <span style={css('font-size: 12px; color: var(--muted-2);')}>{note}</span> : null}
    </div>
  );
}

// Daily cost, one bar per day. Days with requests but no priced cost get a hairline so activity still shows.
function DailyChart({ days }) {
  const [hover, setHover] = useState(-1);
  const max = Math.max(...days.map((d) => d.cost), 0);
  const label = (d) => shortDay(d.day) + ': ' + usd(d.cost) + ', ' + whole(d.requests) + (d.requests === 1 ? ' request' : ' requests');
  const tickEvery = Math.max(1, Math.ceil(days.length / 8));
  const h = hover >= 0 ? days[hover] : null;
  return (
    <div style={css('display: flex; flex-direction: column; gap: 8px; min-width: 0;')}>
      <div style={css('position: relative; height: 160px; display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--line-3);')}
        role="img" aria-label={'Estimated cost per day. Highest day ' + usd(max) + '.'} onMouseLeave={() => setHover(-1)}>
        {days.map((d, i) => {
          const pct = max ? (d.cost / max) * 100 : 0;
          return (
            <div key={d.day} onMouseEnter={() => setHover(i)} title={label(d)}
              style={css('flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; cursor: default;')}>
              <div style={css('width: 100%; border-radius: 4px 4px 0 0; background: var(--ink); opacity: ' + (hover < 0 || hover === i ? 1 : 0.35) + '; height: ' +
                (pct ? 'max(2px, ' + pct + '%)' : d.requests ? '2px' : '0') + ';')}></div>
            </div>
          );
        })}
        {h ? (
          <div role="status" style={css('position: absolute; top: 0; ' + (hover > days.length / 2 ? 'right' : 'left') + ': ' + (hover > days.length / 2 ? (100 - ((hover + 1) / days.length) * 100) : (hover / days.length) * 100) + '%; padding: 8px 10px; border: 1px solid var(--line-4); border-radius: 10px; background: var(--surface); box-shadow: 0 8px 24px rgba(0,0,0,0.12); font-size: 12px; color: var(--ink-2); pointer-events: none; white-space: nowrap;')}>
            <div style={css('font-weight: 700; color: var(--ink);')}>{shortDay(h.day)}</div>
            <div>{usd(h.cost)}{h.unpriced ? ' + ' + h.unpriced + ' unpriced' : ''}</div>
            <div style={css('color: var(--muted);')}>{whole(h.requests)} requests · {compact(inTok(h) + h.output)} tokens{h.images ? ' · ' + h.images + ' images' : ''}</div>
          </div>
        ) : null}
      </div>
      <div aria-hidden="true" style={css('display: flex; gap: 2px; font-size: 11px; color: var(--muted-2); font-variant-numeric: tabular-nums;')}>
        {days.map((d, i) => <span key={d.day} style={css('flex: 1 1 0; min-width: 0; overflow: visible; white-space: nowrap;')}>{i % tickEvery === 0 ? shortDay(d.day) : ''}</span>)}
      </div>
    </div>
  );
}

function Table({ caption, cols, rows }) {
  return (
    <div style={css('overflow-x: auto; min-width: 0;')}>
      <table style={css('width: 100%; border-collapse: collapse;')}>
        <caption style={css('position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);')}>{caption}</caption>
        <thead><tr>{cols.map((c) => <th key={c[0]} scope="col" style={css(th + (c[1] ? num : ''))}>{c[0]}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function PriceEditor({ m, onSaved, onCancel }) {
  const p = m.price || {};
  const isImage = m.imageModel || (m.images > 0 && !(m.input || m.output));
  const [v, setV] = useState({ in: p.in ?? '', out: p.out ?? '', cacheRead: p.cacheRead ?? '', image: p.image ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async (price) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/ai/usage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: m.provider, model: m.model, price }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not save the price.');
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const field = (k, label) => (
    <label style={css('display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--muted);')}>
      {label}
      <input type="number" min="0" step="any" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={css(input)} />
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(isImage ? { image: v.image } : { in: v.in, out: v.out, cacheRead: v.cacheRead }); }}
      style={css('display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 12px; border-radius: 12px; background: var(--panel);')}>
      {isImage ? field('image', 'USD per image') : <>{field('in', 'Input $/1M')}{field('out', 'Output $/1M')}{field('cacheRead', 'Cache read $/1M')}</>}
      <button type="submit" disabled={busy} style={css(primary)}>Save price</button>
      {m.priceSource === 'custom' ? <button type="button" disabled={busy} onClick={() => send(null)} style={css(ghost)}>Reset to default</button> : null}
      <button type="button" disabled={busy} onClick={onCancel} style={css(ghost)}>Cancel</button>
      {err ? <p role="alert" style={css('margin: 0; width: 100%; font-size: 13px; color: var(--red-ink);')}>{err}</p> : null}
    </form>
  );
}

async function fetchUsage(range) {
  const res = await fetch('/api/ai/usage?range=' + encodeURIComponent(range), { cache: 'no-store' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Could not load AI usage.');
  return j;
}

export default function AiUsage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState('');

  // Bumping `tick` refetches the current range (Refresh, after a price change).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetchUsage(range).then(
      (j) => { if (live) { setData(j); setError(''); setLoading(false); } },
      (e) => { if (live) { setError(e.message); setLoading(false); } },
    );
    return () => { live = false; };
  }, [range, tick]);
  const reload = () => { setLoading(true); setTick((n) => n + 1); };
  const pickRange = (r) => { if (r !== range) { setLoading(true); setRange(r); } };

  const t = data && data.ready ? data.total : null;
  return (
    <div style={css('display: flex; flex-direction: column; gap: 20px; min-width: 0;')}>
      <section aria-labelledby="ws-ai" style={css(panel)}>
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;')}>
          <div style={css('display: flex; flex-direction: column; gap: 4px; min-width: 0;')}>
            <h2 id="ws-ai" style={css(h2)}>AI usage</h2>
            <p style={css(sub)}>Requests, tokens and estimated cost for the Daily assistant, research drafts and idea covers. Check each provider&rsquo;s billing page for the actual bill.</p>
          </div>
          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px;')}>
            <div role="group" aria-label="Date range" style={css(seg)}>
              {RANGES.map(([id, label]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => pickRange(id)} style={css(segBtn(range === id))}>{label}</button>)}
            </div>
            <button type="button" onClick={reload} disabled={loading} style={css(ghost)}>{loading ? 'Loading…' : 'Refresh'}</button>
          </div>
        </div>
        {error ? <p role="alert" style={css('margin: 0; font-size: 13px; color: var(--red-ink);')}>{error}</p> : null}
        {data && !data.ready ? <p role="alert" style={css('margin: 0; font-size: 13px; color: var(--red-ink);')}>{data.error}</p> : null}
      </section>

      {t ? (
        <>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 12px;')}>
            <Stat label="Estimated cost" value={usd(t.cost)} note={t.unpriced ? whole(t.unpriced) + ' calls not priced' : 'All calls priced'} />
            <Stat label="Requests" value={whole(t.requests)} note={t.failed ? whole(t.failed) + ' failed' : 'None failed'} />
            <Stat label="Input tokens" value={compact(inTok(t))} note={t.cacheRead ? compact(t.cacheRead) + ' from cache' : 'No cache hits'} />
            <Stat label="Output tokens" value={compact(t.output)} note={t.reasoning ? compact(t.reasoning) + ' reasoning' : ''} />
            <Stat label="Images" value={whole(t.images)} note="Idea covers" />
          </div>

          {t.unpriced ? (
            <p role="note" style={css('margin: 0; padding: 12px 14px; border-radius: 12px; background: var(--panel); font-size: 13px; color: var(--ink-3);')}>
              {whole(t.unpriced)} calls use a model without a price, so the cost above leaves them out (marked +). Set a price under By model.
            </p>
          ) : null}

          <section aria-labelledby="ai-daily" style={css(panel)}>
            <h3 id="ai-daily" style={css(h2 + ' font-size: 16px;')}>Estimated cost per day</h3>
            {t.requests ? <DailyChart days={data.days} /> : <p style={css(sub)}>No AI calls in this range yet.</p>}
            {data.truncated ? <p style={css(sub)}>Showing the most recent 50,000 calls in this range.</p> : null}
          </section>

          <section aria-labelledby="ai-feat" style={css(panel)}>
            <h3 id="ai-feat" style={css(h2 + ' font-size: 16px;')}>By feature</h3>
            {data.features.length ? (
              <Table caption="AI usage by feature" cols={[['Feature'], ['Requests', 1], ['Input', 1], ['Output', 1], ['Images', 1], ['Est. cost', 1]]}
                rows={data.features.map((f) => (
                  <tr key={f.feature}>
                    <th scope="row" style={css(rowHead)}>{FEATURES[f.feature] || f.feature}</th>
                    <td style={css(td + num)}>{whole(f.requests)}</td><td style={css(td + num)}>{compact(inTok(f))}</td>
                    <td style={css(td + num)}>{compact(f.output)}</td><td style={css(td + num)}>{whole(f.images)}</td>
                    <td style={css(td + num + ' font-weight: 600; color: var(--ink);')}>{costCell(f)}</td>
                  </tr>
                ))} />
            ) : <p style={css(sub)}>Nothing yet.</p>}
          </section>

          <section aria-labelledby="ai-model" style={css(panel)}>
            <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
              <h3 id="ai-model" style={css(h2 + ' font-size: 16px;')}>By model</h3>
              <p style={css(sub)}>Claude models are priced from Anthropic&rsquo;s list prices. Set prices for other models from the provider&rsquo;s pricing page; a custom price also reprices past calls.</p>
            </div>
            {data.models.length ? (
              <Table caption="AI usage by model" cols={[['Model'], ['Price'], ['Requests', 1], ['Input', 1], ['Output', 1], ['Est. cost', 1], ['']]}
                rows={data.models.map((m) => (
                    <tr key={m.key}>
                      <th scope="row" style={css(rowHead)}>
                        <div style={css('white-space: nowrap;')}>{m.model}</div><div style={css('font-size: 12px; font-weight: 500; color: var(--muted);')}>{m.providerName}</div>
                      </th>
                      <td style={css(td)}>
                        {m.priceSource === 'none' ? <span style={css(tag('warn'))}>No price set</span> : (
                          <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
                            <span style={css('font-size: 12px; color: var(--ink-3); white-space: nowrap;')}>
                              {m.price.image != null && !(m.input || m.output) ? usd(m.price.image) + ' / image' : perM(m.price.in) + ' in · ' + perM(m.price.out) + ' out /1M'}
                            </span>
                            {m.priceSource === 'custom' ? <span style={css(tag())}>Custom</span> : null}
                          </div>
                        )}
                      </td>
                      <td style={css(td + num)}>{whole(m.requests)}</td><td style={css(td + num)}>{m.images && !inTok(m) ? '—' : compact(inTok(m))}</td>
                      <td style={css(td + num)}>{m.images && !m.output ? whole(m.images) + ' img' : compact(m.output)}</td>
                      <td style={css(td + num + ' font-weight: 600; color: var(--ink);')}>{m.priceSource === 'none' ? '—' : costCell(m)}</td>
                      <td style={css(td + num)}>
                        <button type="button" aria-expanded={editing === m.key} aria-label={'Edit price for ' + m.model} onClick={() => setEditing(editing === m.key ? '' : m.key)} style={css(ghost)}>Edit price</button>
                      </td>
                    </tr>
                ))} />
            ) : <p style={css(sub)}>Nothing yet.</p>}
            {(() => {
              const m = data.models.find((x) => x.key === editing);
              return m ? (
                <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
                  <span style={css('font-size: 13px; font-weight: 600; color: var(--ink);')}>Price for {m.model}</span>
                  <PriceEditor key={m.key} m={m} onCancel={() => setEditing('')} onSaved={() => { setEditing(''); reload(); }} />
                </div>
              ) : null;
            })()}
          </section>

          <section aria-labelledby="ai-member" style={css(panel)}>
            <h3 id="ai-member" style={css(h2 + ' font-size: 16px;')}>By member</h3>
            {data.members.length ? (
              <Table caption="AI usage by member" cols={[['Member'], ['Requests', 1], ['Input', 1], ['Output', 1], ['Images', 1], ['Est. cost', 1]]}
                rows={data.members.map((u) => (
                  <tr key={u.id || 'none'}>
                    <th scope="row" style={css(rowHead)}>{u.name}</th>
                    <td style={css(td + num)}>{whole(u.requests)}</td><td style={css(td + num)}>{compact(inTok(u))}</td>
                    <td style={css(td + num)}>{compact(u.output)}</td><td style={css(td + num)}>{whole(u.images)}</td>
                    <td style={css(td + num + ' font-weight: 600; color: var(--ink);')}>{costCell(u)}</td>
                  </tr>
                ))} />
            ) : <p style={css(sub)}>Nothing yet.</p>}
          </section>
        </>
      ) : loading && !error ? <p style={css(sub)}>Loading AI usage…</p> : null}
    </div>
  );
}
