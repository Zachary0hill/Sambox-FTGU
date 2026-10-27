'use client';
// Performance page body: filters, totals against the previous period, reach over time, sources, channels and top
// posts. Everything it shows comes from perfVals() in lib/studio/vals-perf.js.
import { css } from '@/lib/studio/css';

const card = 'display: flex; flex-direction: column; gap: 16px; padding: 24px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); min-width: 0;';
const h2 = 'margin: 0; font-family: var(--font-title); font-size: 20px; font-weight: var(--weight-black); letter-spacing: -0.02em; color: var(--ink);';
const sub = 'margin: 0; font-size: 13px; color: var(--muted);';
const label = 'font-size: 13px; font-weight: 600; color: var(--muted-2);';
const num = 'font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap;';
// Shared grid for the three tables: a name column, then four number columns. On phones (globals.css, .fb-prow) each
// row turns into a card: name and action on top, the four numbers labeled underneath.
const grid = 'display: grid; grid-template-columns: minmax(200px, 1fr) repeat(4, minmax(72px, 96px)) minmax(76px, auto); align-items: center; column-gap: 12px;';
const th = 'font-size: 12px; font-weight: 600; color: var(--muted-2); padding: 0 0 8px;';
const CH_COLS = ['Posts', 'Reach', 'Engagements', 'Eng. rate'];
const TOP_COLS = ['Published', 'Reach', 'Engagements', 'Eng. rate'];
// Shorter labels for the phone cards, where four numbers share one line.
const CH_SHORT = ['Posts', 'Reach', 'Eng.', 'Eng. rate'];
const TOP_SHORT = ['Published', 'Reach', 'Eng.', 'Eng. rate'];
const smallBtn = 'min-height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;';

function Select({ id, text, value, options, onChange, style }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
      <label htmlFor={id} style={css(label)}>{text}</label>
      <select id={id} value={value} onChange={onChange} style={css(style)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Head({ cols, first, last }) {
  return (
    <div role="row" className="fb-phead" style={css(grid + ' border-bottom: 1px solid var(--line);')}>
      <span role="columnheader" style={css(th)}>{first}</span>
      {cols.map((c) => <span key={c} role="columnheader" style={css(th + num)}>{c}</span>)}
      <span role="columnheader" style={css(th + ' position: relative;')}><span style={css('position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)')}>{last}</span></span>
    </div>
  );
}

export default function Performance({ p, ui }) {
  if (!p.hasAny) {
    return (
      <section aria-labelledby="pf-empty" style={css(card + ' align-items: flex-start;')}>
        <h2 id="pf-empty" style={css(h2)}>No performance data yet</h2>
        <p style={css(sub + ' max-width: 560px; font-size: var(--text-body-sm);')}>{p.emptyText}</p>
        <button type="button" onClick={p.openInteg} style={css(ui.btnGhost)}>Open Integrations</button>
        <Sources p={p} />
      </section>
    );
  }
  const c = p.chart;
  return (
    <>
      {/* Filters */}
      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px')}>
        <Select id="pf-src" text="Source" value={p.src} options={p.srcOpts} onChange={p.onSrc} style={p.selStyle} />
        <Select id="pf-ch" text="Channel" value={p.ch} options={p.chOpts} onChange={p.onCh} style={p.selStyle} />
        <Select id="pf-range" text="Date range" value={p.range} options={p.rangeOpts} onChange={p.onRange} style={p.selStyle} />
        <p style={css('margin: 0 0 12px; font-size: 13px; color: var(--muted); flex: 1 1 220px')}>{p.periodText}</p>
      </div>
      {p.historyNote ? <p role="note" style={css('margin: -12px 0 0; font-size: 13px; color: var(--muted)')}>{p.historyNote}</p> : null}
      {p.hasStale ? (
        <div role="note" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface)')}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none; color: var(--ink-3)')}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>
          <p style={css('margin: 0; flex: 1 1 240px; font-size: 14px; color: var(--ink-2)')}>{p.staleText}</p>
          {p.staleFix ? <button type="button" onClick={p.openInteg} style={css(smallBtn)}>Open Integrations</button> : null}
        </div>
      ) : null}

      {/* Totals */}
      <section aria-label="Totals for this period" style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 12px')}>
        {p.kpis.map((k) => (
          <div key={k.label} style={css(ui.stat)}>
            <span style={css('font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)')}>{k.label}</span>
            <span style={css('font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums')}>{k.value}</span>
            <span aria-label={k.delta.aria + ' vs previous period'} style={css(k.delta.style)}>
              {k.delta.dir ? (
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d={k.delta.dir > 0 ? 'M5 1.5 9 7H1z' : 'M5 8.5 1 3h8z'} fill="currentColor"></path></svg>
              ) : null}
              {k.delta.text}
            </span>
            <span className="fb-khelp" style={css('font-size: 12px; color: var(--muted)')}>{k.help}</span>
          </div>
        ))}
      </section>

      {/* Reach over time */}
      <section aria-labelledby="pf-chart" style={css(card)}>
        <div style={css('display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px')}>
          <div style={css('display: flex; flex-direction: column; gap: 4px')}>
            <h2 id="pf-chart" style={css(h2)}>Reach over time</h2>
            <p style={css(sub)}>{c.caption}</p>
          </div>
          <ul aria-label="Sources" style={css('display: flex; flex-wrap: wrap; gap: 14px; margin: 0; padding: 0; list-style: none')}>
            {c.legend.map((l) => <li key={l.label} style={css('display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-3)')}><span aria-hidden="true" style={css(l.swatch)}></span>{l.label}</li>)}
          </ul>
        </div>
        {c.empty ? (
          <p style={css('margin: 0; padding: 48px 0; text-align: center; font-size: 14px; color: var(--muted)')}>No reach reported for this period yet.</p>
        ) : (
          <div style={css('display: flex; gap: 8px')}>
            <span aria-hidden="true" style={css('flex: none; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums')}>{c.yMax}</span>
            <div style={css('flex: 1; min-width: 0')}>
              <svg role="img" aria-label={c.aria} viewBox={'0 0 ' + c.w + ' ' + c.h} preserveAspectRatio="none" style={css('display: block; width: 100%; height: 200px; overflow: visible')}>
                <line x1="0" x2={c.w} y1={c.h} y2={c.h} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
                {c.rects.map((r) => <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} rx="1.5" fill={r.fill}></rect>)}
                {c.hits.map((h) => <rect key={h.key} x={h.x} y="0" width={h.w} height={c.h} fill="transparent"><title>{h.title}</title></rect>)}
              </svg>
              <div aria-hidden="true" style={css('position: relative; height: 20px; margin-top: 8px')}>
                {c.ticks.map((t) => <span key={t.key} style={css(t.style)}>{t.label}</span>)}
              </div>
            </div>
          </div>
        )}
      </section>

      <Sources p={p} card />

      {/* Channels */}
      <section aria-labelledby="pf-ch-h" style={css(card)}>
        <div style={css('display: flex; flex-direction: column; gap: 4px')}>
          <h2 id="pf-ch-h" style={css(h2)}>Channels</h2>
          <p style={css(sub)}>Pick a channel to filter the whole page to it.</p>
        </div>
        {p.noChannels ? <p style={css(sub)}>No channel published in this period.</p> : (
          <div className="fb-scrollx" tabIndex={0} role="region" aria-label="Channels table" style={css('overflow-x: auto')}>
            <div role="table" aria-label="Channels" className="fb-ptable" style={css('min-width: 640px')}>
              <Head first="Channel" cols={CH_COLS} last="Filter" />
              {p.channels.map((r) => (
                <div key={r.name + r.sub} role="row" className="fb-prow" style={css(grid + ' min-height: 56px; border-bottom: 1px solid var(--line);' + (r.on ? ' background: var(--chip);' : ''))}>
                  <span role="cell" className="fb-pname" style={css('display: flex; align-items: center; gap: 10px; min-width: 0')}>
                    <span aria-hidden="true" style={css(r.swatch)}></span>
                    <span style={css('display: flex; flex-direction: column; min-width: 0')}>
                      <span style={css('font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{r.name}</span>
                      <span style={css('font-size: 12px; color: var(--muted)')}>{r.sub}</span>
                    </span>
                  </span>
                  {r.stats.map((v, i) => <span key={i} role="cell" className="fb-pnum" data-label={CH_SHORT[i]} style={css(num + ' font-size: 14px;')}>{v}</span>)}
                  <span role="cell" className="fb-pact" style={css('display: flex; justify-content: flex-end')}>
                    <button type="button" aria-pressed={r.pressed} aria-label={r.aria} onClick={r.pick} style={css(smallBtn)}>{r.on ? 'Clear' : 'Filter'}</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Top content */}
      <section aria-labelledby="pf-top" style={css(card)}>
        <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px')}>
          <div style={css('display: flex; flex-direction: column; gap: 4px')}>
            <h2 id="pf-top" style={css(h2)}>Top content</h2>
            <p style={css(sub)}>Videos and posts that went out in this period.</p>
          </div>
          <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px')}>
            <Select id="pf-sort" text="Sort by" value={p.sort} options={p.sortOpts} onChange={p.onSort} style={p.selStyle} />
            {p.canExport ? <button type="button" onClick={p.exportCsv} style={css(ui.btnGhost)}>Export CSV</button> : null}
          </div>
        </div>
        {p.noTop ? <p style={css(sub)}>{p.topEmpty}</p> : (
          <div className="fb-scrollx" tabIndex={0} role="region" aria-label="Top content table" style={css('overflow-x: auto')}>
            <div role="table" aria-label="Top content" className="fb-ptable" style={css('min-width: 640px')}>
              <Head first="Post" cols={TOP_COLS} last="Link" />
              {p.top.map((r) => (
                <div key={r.key} role="row" className="fb-prow fb-ptop" style={css(grid + ' min-height: 60px; border-bottom: 1px solid var(--line);')}>
                  <span role="cell" className="fb-pname" style={css('display: flex; align-items: center; gap: 12px; min-width: 0')}>
                    <span aria-hidden="true" className="fb-prank" style={css('width: 18px; flex: none; font-size: 12px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums')}>{r.rank}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube or Buffer thumbnail, sized by CSS */}
                    {r.hasThumb ? <img className="fb-pthumb" src={r.thumb} alt="" loading="lazy" style={css(r.thumbStyle)} /> : <span aria-hidden="true" style={css(r.noThumbStyle)}></span>}
                    <span style={css('display: flex; flex-direction: column; min-width: 0')}>
                      {/* The title is the link (and the keyboard stop); Open repeats it for the mouse and is hidden on phones. */}
                      {r.hasUrl
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.linkAria} className="fb-ptitle fb-ptlink" style={css('font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); text-decoration: none')}>{r.title}</a>
                        : <span className="fb-ptitle" style={css('font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{r.title}</span>}
                      <span style={css('font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{r.meta}</span>
                    </span>
                  </span>
                  <span role="cell" className="fb-pnum" data-label={TOP_SHORT[0]} style={css(num + ' font-size: 13px; color: var(--ink-3);')}>{r.date}</span>
                  {r.stats.map((v, i) => <span key={i} role="cell" className="fb-pnum" data-label={TOP_SHORT[i + 1]} style={css(num + ' font-size: 14px;')}>{v}</span>)}
                  <span role="cell" className="fb-pact" style={css('display: flex; justify-content: flex-end')}>
                    {r.hasUrl ? <a href={r.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" style={css(smallBtn + ' display: inline-flex; align-items: center; text-decoration: none;')}>Open</a> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {p.hasMore ? <button type="button" onClick={p.toggleMore} style={css(ui.btnGhost + ' align-self: flex-start;')}>{p.moreLabel}</button> : null}
      </section>
    </>
  );
}

// Every content integration in the registry, connected or not, with what it brought in this period.
function Sources({ p, card: asCard }) {
  const body = (
    <div className="fb-scrollx" tabIndex={0} role="region" aria-label="Sources table" style={css('overflow-x: auto; align-self: stretch; min-width: 0')}>
      <div role="table" aria-label="Sources" className="fb-ptable" style={css('min-width: 640px')}>
        <Head first="Source" cols={CH_COLS} last="Action" />
        {p.sources.map((r) => (
          <div key={r.name} role="row" className="fb-prow" style={css(grid + ' min-height: 64px; padding: 8px 0; border-bottom: 1px solid var(--line);')}>
            <span role="cell" className="fb-pname" style={css('display: flex; align-items: flex-start; gap: 10px; min-width: 0')}>
              <span aria-hidden="true" style={css(r.swatch + ' margin-top: 5px;')}></span>
              <span style={css('display: flex; flex-direction: column; gap: 4px; min-width: 0')}>
                <span style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px')}>
                  <span style={css('font-size: 14px; font-weight: 600')}>{r.name}</span>
                  <span style={css(r.statusStyle)}>{r.status}</span>
                </span>
                <span style={css('font-size: 12px; line-height: 1.4; color: ' + (r.hasErr ? 'var(--red-ink)' : 'var(--muted)'))}>{r.sub}</span>
              </span>
            </span>
            {r.stats.map((v, i) => <span key={i} role="cell" className="fb-pnum" data-label={CH_SHORT[i]} style={css(num + ' font-size: 14px;' + (r.on ? '' : ' color: var(--muted);'))}>{v}</span>)}
            <span role="cell" className="fb-pact" style={css('display: flex; justify-content: flex-end')}>
              {r.action ? <button type="button" aria-label={r.actAria} onClick={r.act} disabled={r.actDisabled} style={css(smallBtn + (r.actDisabled ? ' opacity: 0.5; cursor: default;' : ''))}>{r.action}</button> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  if (!asCard) return body;
  return (
    <section aria-labelledby="pf-src-h" style={css(card)}>
      <div style={css('display: flex; flex-direction: column; gap: 4px')}>
        <h2 id="pf-src-h" style={css(h2)}>Sources</h2>
        <p style={css(sub)}>Content integrations from Workspace Settings. Numbers cover this period.</p>
      </div>
      {body}
    </section>
  );
}
