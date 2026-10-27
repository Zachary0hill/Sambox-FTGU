'use client';
// Admin > Workload page body: undo banner, tiles, Needs attention, Due next 14 days, Pipeline, Team capacity,
// Assignments and Workflow. Everything it shows and every handler comes from the Workload block in
// lib/studio/vals-admin.js (V.adm.wl). Hover rules are the fb-wl-* classes in app/globals.css.
import { Fragment, useEffect, useRef } from 'react';
import { css } from '@/lib/studio/css';

const card = 'background: var(--surface); border: 1px solid var(--border); border-radius: 16px; min-width: 0; box-sizing: border-box;';
const h2 = 'margin: 0; font-family: var(--font-title); font-weight: var(--weight-black); font-size: 18px; letter-spacing: -0.01em; color: var(--ink);';
const sub = 'font-size: 13px; color: var(--muted);';
const countPill = 'display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 12px; background: var(--track); font-size: 12px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums;';
const segTrack = 'display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; background: var(--chip); border-radius: 12px;';
const big = 'font-family: var(--font-title); font-weight: var(--weight-black); line-height: 1; font-variant-numeric: tabular-nums; color: var(--ink);';
const srOnly = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;';
const TEAM_COLS = 'display: grid; grid-template-columns: minmax(160px, 1fr) 172px 52px 52px 82px 446px; gap: 12px; align-items: center;';
const ASG_COLS = 'display: grid; grid-template-columns: minmax(220px, 2fr) 136px 132px 132px 88px 88px 76px minmax(130px, 1fr); gap: 12px; align-items: center;';

const X = ({ size = 14, sw = 2 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>
);
const Check = ({ size = 18, color = 'currentColor', sw = 2.2 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10"></path></svg>
);
const Plus = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"></path></svg>
);

// Inline picker for an editor or designer: options sorted by load, each with its slots bar. Escape closes it.
function AssignPicker({ pk, bg, cancel }) {
  const first = useRef(null);
  useEffect(() => { if (first.current) first.current.focus(); }, []);
  return (
    <div role="group" aria-label={pk.label} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); pk.close(); } }}
      style={css('display: flex; flex-direction: column; gap: 10px; padding: ' + (cancel ? '14px' : '4px') + ' 20px 16px; background: ' + bg + ';')}>
      <span style={css('font-size: 12px; font-weight: 600; color: var(--muted);')}>{pk.label}</span>
      {pk.empty ? <span style={css('font-size: 13px; color: var(--muted);')}>{pk.emptyText}</span> : null}
      <div style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
        {pk.options.map((o, i) => (
          <button key={o.name} ref={i === 0 ? first : null} type="button" className="fb-wl-opt" aria-label={o.aria} onClick={o.pick} style={css(o.style)}>
            <span aria-hidden="true" style={css(o.avStyle)}>{o.initial}</span>
            <span style={css('display: flex; flex-direction: column; align-items: flex-start; gap: 4px;')}>
              <span style={css('font-size: 14px; font-weight: 600;')}>{o.name}</span>
              <span style={css('display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums;')}>
                <span style={css('display: block; width: 44px; height: 5px; border-radius: 3px; background: var(--track); overflow: hidden;')}><span className="fb-wl-anim" style={css(o.fillStyle)}></span></span>
                {o.load}
              </span>
            </span>
            {o.full ? <span style={css('font-size: 11px; font-weight: 700; color: var(--red-ink); background: var(--red-soft); padding: 3px 7px; border-radius: 6px; white-space: nowrap;')}>At capacity</span> : null}
          </button>
        ))}
        {cancel ? <button type="button" onClick={pk.close} style={css('min-height: 52px; padding: 0 14px; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer;')}>Cancel</button> : null}
      </div>
    </div>
  );
}

// The status region stays mounted (hidden when empty) so screen readers announce each new assignment.
function UndoBanner({ w }) {
  return (
    <div role="status" style={css(w.hasLast ? 'display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; background: #111111; color: #FFFFFF; border: 1px solid var(--card-border); border-radius: 14px; font-size: 14px; font-weight: 500;' : srOnly)}>
      {w.hasLast ? (
        <>
          <Check color="#7BE0A0" />
          <span style={css('flex: 1; min-width: 0;')}>{w.lastText}</span>
          <button type="button" className="fb-wl-dark" onClick={w.undo} style={css('min-height: 36px; padding: 0 14px; border: 1px solid #444444; border-radius: 10px; background: transparent; color: #FFFFFF; font-size: 14px; font-weight: 600; cursor: pointer;')}>Undo</button>
          <button type="button" className="fb-wl-dark" aria-label="Dismiss" onClick={w.dismiss} style={css('width: 36px; height: 36px; flex: none; border: 0; border-radius: 10px; background: transparent; color: #BDBDBD; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;')}><X size={16} /></button>
        </>
      ) : null}
    </div>
  );
}

function Tiles({ w }) {
  return (
    <section aria-label="Key numbers" style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 188px), 1fr)); gap: 12px;')}>
      {w.kpis.map((k) => (
        <button key={k.id} type="button" className="fb-wl-tile" onClick={k.pick} aria-pressed={k.isFilter ? k.pressed : undefined} aria-label={k.aria} style={css(k.style)}>
          <span style={css('display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;')}>
            <span style={css('font-size: 13px; font-weight: 600; color: var(--ink-2);')}>{k.label}</span>
            <span aria-hidden="true" style={css(k.dotStyle)}></span>
          </span>
          <span style={css('display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; width: 100%;')}>
            <span style={css(big + ' font-size: 34px;')}>{k.value}</span>
            {k.hasSpark ? (
              <svg aria-hidden="true" width="96" height="34" viewBox="0 0 96 34" style={css('flex: none;')}>
                <polyline points={k.area} fill={k.fill} stroke="none"></polyline>
                <polyline points={k.points} fill="none" stroke={k.stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"></polyline>
                <circle cx={k.cx} cy={k.cy} r="3.2" fill={k.stroke}></circle>
              </svg>
            ) : null}
          </span>
          <span style={css('display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--muted);')}>
            {k.hasDelta ? <span style={css(k.deltaStyle)}>{k.delta}</span> : null}
            <span>{k.sub}</span>
          </span>
        </button>
      ))}
    </section>
  );
}

function Attention({ w }) {
  return (
    <section id="attention" className="fb-wl-att" aria-labelledby="wl-att-h" style={css(card + ' overflow: hidden; scroll-margin-top: 16px;')}>
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 14px;')}>
        <div style={css('display: flex; align-items: center; gap: 10px;')}>
          <h2 id="wl-att-h" style={css(h2)}>Needs attention</h2>
          <span style={css(countPill)}>{w.attTotal}</span>
        </div>
        <div role="tablist" aria-label="Filter attention items" style={css(segTrack)}>
          {w.attTabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.selected} aria-controls="wl-att-list" onClick={t.pick} style={css(t.style)}>
              {t.label}<span style={css(t.countStyle)}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div id="wl-att-list" role="tabpanel" aria-labelledby="wl-att-h">
        {w.attItems.map((a) => (
          <div key={a.key} style={css('border-top: 1px solid var(--line-2);')}>
            <div className="fb-wl-row fb-wl-arow" style={css('display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 20px; box-sizing: border-box; background: var(--surface);')}>
              <span style={css(a.reasonStyle)}>{a.reason}</span>
              <div className="fb-wl-atitle" style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;')}>
                <span style={css('font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{a.title}</span>
                <span style={css('font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{a.meta}</span>
              </div>
              <span style={css(a.dueStyle)}>{a.due}</span>
              <button type="button" className="fb-wl-act" onClick={a.act} disabled={a.disabled} aria-expanded={a.expanded} aria-label={a.actAria} style={css(a.actStyle)}>{a.actLabel}</button>
            </div>
            {a.picker && a.picker.open ? <AssignPicker pk={a.picker} bg="var(--surface)" /> : null}
          </div>
        ))}
        {w.attEmpty ? (
          <div style={css('display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; border-top: 1px solid var(--line-2); text-align: center;')}>
            <span style={css('display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--green-soft); color: var(--green-ink);')}><Check size={20} /></span>
            <span style={css('font-size: 15px; font-weight: 600; color: var(--ink);')}>All clear</span>
            <span style={css(sub)}>Nothing in this filter needs you right now.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DueChart({ w }) {
  return (
    <section aria-labelledby="wl-due-h" style={css(card + ' padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 16px;')}>
      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
          <h2 id="wl-due-h" style={css(h2)}>Due next 14 days</h2>
          <span style={css(sub)}>{w.dueSummary}</span>
        </div>
        <div role="group" aria-label="Series" style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
          {w.series.map((se) => (
            <button key={se.label} type="button" className="fb-wl-chip" aria-pressed={se.pressed} aria-label={se.aria} onClick={se.toggle} style={css(se.style)}>
              <span aria-hidden="true" style={css(se.swatch)}></span>{se.label}
            </button>
          ))}
        </div>
      </div>
      {w.hasOverdue ? (
        <div style={css('display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600;')}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none;')}><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
          <span style={css('min-width: 0;')}>{w.overdueText}</span>
        </div>
      ) : null}
      <div style={css('display: flex; gap: 8px;')}>
        <div aria-hidden="true" style={css('display: flex; flex-direction: column; justify-content: space-between; height: 176px; width: 14px; flex: none; font-size: 11px; font-weight: 600; color: var(--faint); text-align: right; font-variant-numeric: tabular-nums;')}>
          {w.yTicks.map((y) => <span key={y} style={css('line-height: 1; transform: translateY(-50%);')}>{y}</span>)}
        </div>
        <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;')}>
          <div style={css('position: relative; height: 176px;')}>
            <div aria-hidden="true" style={css('position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between;')}>
              {w.yTicks.map((y) => <span key={y} style={css('display: block; height: 1px; background: var(--line-2);')}></span>)}
            </div>
            <div role="group" aria-label="Deadlines per day" style={css('position: relative; height: 100%; display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 4px;')}>
              {w.days.map((d) => (
                <button key={d.d} type="button" className="fb-wl-col" onMouseEnter={d.pick} onFocus={d.pick} onClick={d.pick} aria-label={d.aria} aria-pressed={d.pressed} style={css(d.colStyle)}>
                  {d.segs.map((g) => <span key={g.id} className="fb-wl-anim" style={css(g.style)}></span>)}
                </button>
              ))}
            </div>
          </div>
          <div aria-hidden="true" style={css('display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 4px;')}>
            {w.days.map((d) => <span key={d.d} style={css(d.labelStyle)}><span>{d.wd}</span><span>{d.num}</span></span>)}
          </div>
        </div>
      </div>
      <div aria-live="polite" style={css('display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line-2);')}>
        <span style={css('font-size: 13px; font-weight: 700; color: var(--ink);')}>{w.dayTitle}</span>
        {w.dayItems.map((it, i) => (
          <button key={i} type="button" className="fb-wl-line" onClick={it.open} aria-label={'Open ' + it.title + ', ' + it.type.toLowerCase()} style={css('display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 0 6px; margin: 0 -6px; border: 0; border-radius: 8px; background: transparent; font-size: 13px; font-weight: 400; color: var(--ink); text-align: left; cursor: pointer;')}>
            <span aria-hidden="true" style={css(it.swatch)}></span>
            <span style={css('width: 92px; flex: none; font-weight: 600; color: var(--ink-2);')}>{it.type}</span>
            <span style={css('flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{it.title}</span>
            <span style={css('flex: none; font-size: 12px; color: var(--muted);')}>{it.who}</span>
          </button>
        ))}
        {w.dayEmpty ? <span style={css(sub)}>Nothing due this day.</span> : null}
      </div>
    </section>
  );
}

function Pipeline({ w }) {
  return (
    <section aria-labelledby="wl-pipe-h" style={css(card + ' padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 16px;')}>
      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 4px; min-width: 0;')}>
          <h2 id="wl-pipe-h" style={css(h2)}>Pipeline</h2>
          <span style={css(sub)}>{w.pipeSummary}</span>
        </div>
        <div style={css('display: flex; flex-wrap: wrap; gap: 16px;')}>
          {w.stages.map((sg) => (
            <span key={sg.label} style={css('display: flex; flex-direction: column; gap: 2px;')}>
              <span style={css('font-size: 11px; font-weight: 600; color: var(--muted);')}>{sg.label}</span>
              <span style={css(big + ' font-size: 18px; font-weight: 800;')}>{sg.count}</span>
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden="true" style={css('display: flex; gap: 3px; height: 14px; border-radius: 7px; overflow: hidden; background: var(--track);')}>
        {w.pipeBar.map((b) => <span key={b.title} className="fb-wl-anim" title={b.title} style={css(b.style)}></span>)}
      </div>
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: 10px;')}>
        {w.statusCards.map((c) => (
          <button key={c.label} type="button" className={c.disabled ? '' : 'fb-wl-tile'} onClick={c.pick} disabled={c.disabled} aria-pressed={c.disabled ? undefined : c.pressed} aria-label={c.aria} style={css(c.style)}>
            <span style={css('display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;')}>
              <span style={css(c.blockStyle)}>{c.label}</span>
              {c.slow ? <span style={css('font-size: 11px; font-weight: 700; color: var(--red-ink); background: var(--red-soft); padding: 3px 7px; border-radius: 6px;')}>Slow</span> : null}
            </span>
            <span style={css('display: flex; align-items: baseline; gap: 6px;')}>
              <span style={css(big + ' font-size: 30px;')}>{c.count}</span>
              <span style={css('font-size: 12px; color: var(--muted);')}>{c.unit}</span>
            </span>
            <span style={css('display: flex; flex-direction: column; gap: 6px; width: 100%;')}>
              <span style={css('display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--muted);')}><span>{c.dwellText}</span><span>{c.targetText}</span></span>
              <span style={css('display: block; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden;')}><span className="fb-wl-anim" style={css(c.dwellFill)}></span></span>
            </span>
            <span style={css('font-size: 11px; font-weight: 600; color: var(--muted-2);')}>{c.stage}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Team({ w }) {
  return (
    <section aria-labelledby="wl-team-h" style={css(card + ' overflow: hidden;')}>
      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px 16px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
          <h2 id="wl-team-h" style={css(h2)}>Team capacity</h2>
          <span style={css(sub)}>Each slot is one active project. Select a person to filter assignments, or a day to see what is due.</span>
        </div>
        <div role="tablist" aria-label="Role" style={css(segTrack)}>
          {w.roleTabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={t.selected} aria-controls="wl-team-table" onClick={t.pick} style={css(t.style)}>{t.label}</button>)}
        </div>
      </div>
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 20px 28px; padding: 0 20px 18px;')}>
        <div style={css('display: flex; align-items: center; gap: 14px;')}>
          <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={w.utilAria} style={css('flex: none;')}>
            <circle cx="34" cy="34" r="26" fill="none" stroke="var(--track)" strokeWidth="10"></circle>
            <circle className="fb-wl-anim" cx="34" cy="34" r="26" fill="none" stroke={w.utilColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={w.utilDash} transform="rotate(-90 34 34)"></circle>
          </svg>
          <span style={css('display: flex; flex-direction: column; gap: 2px;')}>
            <span style={css(big + ' font-size: 26px;')}>{w.utilPct}</span>
            <span style={css('font-size: 12px; font-weight: 600; color: var(--muted);')}>Team utilization</span>
          </span>
        </div>
        {w.teamStats.map((ts) => (
          <span key={ts.label} style={css('display: flex; flex-direction: column; gap: 2px; padding-left: 20px; border-left: 1px solid var(--line-2);')}>
            <span style={css(big + ' font-size: 22px; line-height: 1.1;')}>{ts.value}</span>
            <span style={css('font-size: 12px; font-weight: 600; color: var(--muted);')}>{ts.label}</span>
          </span>
        ))}
        <span style={css('flex: 1;')}></span>
        <span aria-hidden="true" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; color: var(--muted);')}>
          Due per day
          {w.heatLegend.map((h) => (
            <Fragment key={h[0]}><span style={css('display: inline-block; width: 14px; height: 14px; border-radius: 4px; background: ' + h[1] + ';')}></span>{h[0]}</Fragment>
          ))}
        </span>
      </div>
      <div className="fb-wl-scroll fb-scrollx" tabIndex={0} role="region" aria-label="Team capacity table, scrolls sideways" style={css('overflow-x: auto; border-top: 1px solid var(--line-2);')}>
        <div id="wl-team-table" role="table" aria-label="Team capacity" style={css('min-width: 960px;')}>
          <div role="row" style={css(TEAM_COLS + ' align-items: end; padding: 10px 20px; font-size: 12px; font-weight: 600; color: var(--muted);')}>
            <span role="columnheader">Person</span><span role="columnheader">Load</span><span role="columnheader">Active</span><span role="columnheader">Late</span><span role="columnheader">Next due</span>
            <span role="columnheader" style={css('display: flex; gap: 4px;')}>
              <span style={css(srOnly)}>Due by day</span>
              {w.dayHeads.map((h, i) => <span key={i} aria-hidden="true" style={css(h.style)}><span>{h.top}</span><span>{h.num}</span></span>)}
            </span>
          </div>
          {w.team.map((p) => (
            <div key={p.id} role="row" style={css(TEAM_COLS + ' min-height: 60px; padding: 6px 20px; box-sizing: border-box; border-top: 1px solid var(--line-2); background: ' + p.rowBg + ';')}>
              <span role="cell" style={css('min-width: 0;')}>
                <button type="button" className="fb-wl-person" onClick={p.pick} aria-pressed={p.pressed} aria-label={p.personAria} style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0; border: 0; background: transparent; cursor: pointer; text-align: left; color: var(--ink); font-weight: 400;')}>
                  <span aria-hidden="true" style={css(p.avStyle)}>{p.initial}</span>
                  <span style={css('display: flex; flex-direction: column; line-height: 1.3;')}>
                    <span className="fb-wl-pname" style={css('font-size: 14px; font-weight: 600;')}>{p.name}</span>
                    <span style={css('font-size: 12px; color: var(--muted);')}>{p.role}</span>
                  </span>
                </button>
              </span>
              <span role="cell" style={css('display: flex; align-items: center; gap: 10px;')}>
                <span role="img" aria-label={p.loadAria} style={css('display: flex; gap: 4px;')}>
                  {p.slots.map((sl, i) => <span key={i} className="fb-wl-anim" title={sl.title} style={css(sl.style)}></span>)}
                </span>
                <span aria-hidden="true" style={css(p.loadTextStyle)}>{p.loadText}</span>
              </span>
              <span role="cell" style={css('font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;')}>{p.active}</span>
              <span role="cell"><span style={css(p.lateStyle)}>{p.late}</span></span>
              <span role="cell" style={css('font-size: 13px; color: var(--ink-2); white-space: nowrap;')}>{p.next}</span>
              <span role="cell" style={css('display: flex; gap: 4px;')}>
                {p.cells.map((c) => <button key={c.key} type="button" className="fb-wl-cell" onClick={c.pick} aria-label={c.aria} aria-pressed={c.pressed} style={css(c.style)}>{c.label}</button>)}
              </span>
            </div>
          ))}
          {w.teamEmpty || w.roleEmpty ? (
            <div role="row" style={css('display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 0 20px; border-top: 1px solid var(--line-2); font-size: 14px; color: var(--muted);')}>
              <span role="cell">{w.teamEmpty ? 'No editors or designers yet.' : 'Nobody in this role yet.'}</span>
              <button type="button" onClick={w.goUsers} style={css('min-height: 36px; padding: 0 4px; border: 0; background: transparent; font-size: 14px; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;')}>Add people in Users</button>
            </div>
          ) : null}
        </div>
      </div>
      {w.hasCell ? (
        <div aria-live="polite" style={css('display: flex; flex-direction: column; gap: 6px; margin: 0 20px 18px; padding: 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line-2);')}>
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px;')}>
            <span style={css('font-size: 13px; font-weight: 700; color: var(--ink);')}>{w.cellTitle}</span>
            <button type="button" onClick={w.clearCell} aria-label="Close day details" style={css('width: 36px; height: 36px; flex: none; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;')}><X /></button>
          </div>
          {w.cellItems.map((it, i) => (
            <button key={i} type="button" className="fb-wl-line" onClick={it.open} aria-label={'Open ' + it.title} style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-height: 36px; padding: 0 6px; margin: 0 -6px; border: 0; border-radius: 8px; background: transparent; font-size: 13px; font-weight: 400; color: var(--ink); text-align: left; cursor: pointer;')}>
              <span style={css(it.blockStyle)}>{it.status}</span>
              <span style={css('font-weight: 600;')}>{it.title}</span>
              <span style={css('color: var(--muted);')}>{it.what}</span>
            </button>
          ))}
          {w.cellEmpty ? <span style={css(sub)}>Nothing due. Open capacity for this day.</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function Person({ p }) {
  return (
    <span style={css('display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 14px; font-weight: 500; color: var(--ink);')}>
      <span aria-hidden="true" style={css(p.av)}>{p.initial}</span>
      <span style={css('min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')}>{p.name}</span>
    </span>
  );
}

function Assignments({ w }) {
  return (
    <section id="assignments" aria-labelledby="wl-asg-h" style={css(card + ' overflow: hidden; scroll-margin-top: 16px;')}>
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 14px;')}>
        <div style={css('display: flex; align-items: center; gap: 10px;')}>
          <h2 id="wl-asg-h" style={css(h2)}>Assignments</h2>
          <span style={css(countPill)}>{w.rowCount}</span>
        </div>
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-width: 0;')}>
          <label className="fb-wl-search" style={css('display: flex; align-items: center; gap: 8px; min-height: 44px; flex: 1 1 200px; min-width: 0; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); color: var(--muted-2);')}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={css('flex: none;')}><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
            <span style={css(srOnly)}>Search projects</span>
            <input type="search" value={w.q} onChange={w.onQ} placeholder="Search projects" style={css('flex: 1; min-width: 0; width: 180px; border: 0; outline: none; background: transparent; font-size: 14px; color: var(--ink);')} />
          </label>
          <label style={css('display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 12px; font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer; white-space: nowrap;')}>
            <input type="checkbox" checked={w.issuesOnly} onChange={w.toggleIssues} style={css('width: 16px; height: 16px; margin: 0; accent-color: var(--ink);')} />
            Only issues
          </label>
        </div>
      </div>
      {w.hasFilters ? (
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 20px 14px;')}>
          {w.filterChips.map((f) => (
            <button key={f.label} type="button" className="fb-wl-chip" onClick={f.clear} aria-label={f.aria} style={css('display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer;')}>
              {f.label}<X size={12} sw={2.4} />
            </button>
          ))}
          <button type="button" onClick={w.clearAll} style={css('min-height: 36px; padding: 0 10px; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; text-decoration: underline; text-underline-offset: 3px;')}>Clear all</button>
        </div>
      ) : null}
      <div className="fb-wl-scroll fb-scrollx" tabIndex={0} role="region" aria-label="Assignments table, scrolls sideways" style={css('overflow-x: auto; border-top: 1px solid var(--line-2);')}>
        <div role="table" aria-label="Assignments" style={css('min-width: 1060px;')}>
          <div role="row" style={css(ASG_COLS + ' padding: 10px 20px; font-size: 12px; font-weight: 600; color: var(--muted); background: var(--surface-2);')}>
            {['Project', 'Status', 'Editor', 'Designer', 'Edit due', 'Thumb due', 'Publish', 'Sponsor'].map((h) => <span key={h} role="columnheader">{h}</span>)}
          </div>
          {w.rows.map((r) => (
            <div key={r.id} role="rowgroup" style={css('border-top: 1px solid var(--line-2);')}>
              <div role="row" className="fb-wl-row" style={css(r.rowStyle)}>
                <span role="cell" style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0;')}>
                  <button type="button" className="fb-wl-title" onClick={r.open} aria-label={r.openAria} style={css('display: block; max-width: 100%; padding: 0; border: 0; background: transparent; font-size: 14px; font-weight: 600; color: var(--ink); text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;')}>{r.title}</button>
                  <span style={css('font-size: 12px; color: var(--muted);')}>{r.sub}</span>
                </span>
                <span role="cell"><span style={css(r.statusStyle)}>{r.status}</span></span>
                <span role="cell" style={css('min-width: 0;')}>
                  {r.editor ? <Person p={r.editor} /> : (
                    <button type="button" className="fb-wl-assign" onClick={r.pickEditor} aria-expanded={r.edOpen} aria-label={r.edAria} style={css(r.edBtnStyle)}><Plus />Assign</button>
                  )}
                </span>
                <span role="cell" style={css('min-width: 0;')}>
                  {r.designer ? <Person p={r.designer} /> : (
                    <button type="button" className="fb-wl-assign" onClick={r.pickDesigner} aria-expanded={r.dsOpen} aria-label={r.dsAria} style={css(r.dsBtnStyle)}><Plus />Assign</button>
                  )}
                </span>
                <span role="cell"><span style={css(r.editStyle)}>{r.editText}</span></span>
                <span role="cell"><span style={css(r.thumbStyle)}>{r.thumbText}</span></span>
                <span role="cell" style={css('font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--ink);')}>{r.pubText}</span>
                <span role="cell" style={css('display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0;')}>
                  <span style={css('max-width: 100%; font-size: 13px; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')} title={r.sponsor}>{r.sponsor}</span>
                  {r.hasApproval ? <span style={css(r.apStyle)}>{r.apText}</span> : null}
                </span>
              </div>
              {r.picker ? <AssignPicker pk={r.picker} bg="var(--surface-2)" cancel /> : null}
            </div>
          ))}
          {w.rowsEmpty ? (
            <div style={css('display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 20px; border-top: 1px solid var(--line-2); text-align: center;')}>
              <span style={css('font-size: 15px; font-weight: 600; color: var(--ink);')}>{w.noProjects ? 'No open projects' : 'No projects match'}</span>
              <span style={css(sub)}>{w.noProjects ? 'New projects show here once they are on the board.' : 'Clear a filter to see more of the board.'}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Workflow({ w }) {
  const stepBtn = 'width: 44px; height: 44px; flex: none; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-size: 18px; font-weight: 600; color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; justify-content: center;';
  return (
    <section aria-labelledby="wl-wf-h" style={css(card + ' padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 18px;')}>
      <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
        <h2 id="wl-wf-h" style={css(h2)}>Workflow</h2>
        <span style={css(sub)}>
          Every project moves through these statuses in order. Edit names and colors in{' '}
          <button type="button" onClick={w.goWorkspace} style={css('padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;')}>Workspace Settings</button>.
        </span>
      </div>
      <ol style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 6px;')}>
        {w.flow.map((f) => (
          <li key={f.label} aria-label={f.aria} style={css('display: flex; align-items: flex-start; gap: 6px;')}>
            <span style={css('display: flex; flex-direction: column; gap: 5px;')}>
              <span aria-hidden="true" style={css(f.style)}>{f.label}<span style={css(f.countStyle)}>{f.count}</span></span>
              <span aria-hidden="true" style={css('font-size: 11px; font-weight: 600; color: var(--muted-2);')}>{f.stage}</span>
            </span>
            {f.arrow ? <svg aria-hidden="true" width="16" height="32" viewBox="0 0 16 30" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 15h11M9 11l4 4-4 4"></path></svg> : null}
          </li>
        ))}
      </ol>
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 24px; padding-top: 18px; border-top: 1px solid var(--line-2);')}>
        <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
          <h3 style={css('margin: 0; font-size: 14px; font-weight: 700; color: var(--ink);')}>Deadline defaults</h3>
          {w.steppers.map((st) => (
            <div key={st.id} role="group" aria-labelledby={st.id + '-l'} style={css('display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--line-2); border-radius: 12px;')}>
              <span style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 200px;')}>
                <span id={st.id + '-l'} style={css('font-size: 14px; font-weight: 600; color: var(--ink);')}>{st.label}</span>
                <span style={css('font-size: 12px; color: var(--muted);')}>{st.hint}</span>
              </span>
              <span style={css('display: flex; align-items: center; gap: 6px;')}>
                <button type="button" className="fb-wl-chip" onClick={st.dec} disabled={!st.canDec} aria-label={st.decAria} style={css(stepBtn + (st.canDec ? '' : ' opacity: 0.4; cursor: default;'))}>{'−'}</button>
                <span aria-live="polite" style={css('display: inline-flex; align-items: center; justify-content: center; min-width: 48px; height: 44px; border-radius: 10px; background: var(--chip); font-size: 15px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums;')}>{st.value}</span>
                <button type="button" className="fb-wl-chip" onClick={st.inc} disabled={!st.canInc} aria-label={st.incAria} style={css(stepBtn + (st.canInc ? '' : ' opacity: 0.4; cursor: default;'))}>+</button>
                <span style={css('font-size: 13px; color: var(--muted); width: 32px;')}>{st.unit}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 4px;')}>
          <h3 style={css('margin: 0 0 8px; font-size: 14px; font-weight: 700; color: var(--ink);')}>Rules</h3>
          {w.rules.map((ru) => (
            <div key={ru.label} style={css('display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; border-bottom: 1px solid var(--line-2);')}>
              <span style={css('display: flex; flex-direction: column; gap: 2px;')}>
                <span style={css('font-size: 14px; font-weight: 600; color: var(--ink);')}>{ru.label}</span>
                <span style={css('font-size: 12px; color: var(--muted);')}>{ru.desc}</span>
              </span>
              <button type="button" role="switch" aria-checked={ru.on} aria-label={ru.label} onClick={ru.toggle} style={css('width: 46px; height: 44px; flex: none; padding: 0; border: 0; background: transparent; display: inline-flex; align-items: center; cursor: pointer;')}>
                <span aria-hidden="true" className="fb-wl-anim" style={css(ru.track)}><span className="fb-wl-anim" style={css(ru.knob)}></span></span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Workload({ w }) {
  // Records today's tile numbers for the sparklines when they differ from what is saved.
  const { snapKey, snapNeeded, saveSnap } = w;
  // saveSnap is a new function each render; the numbers in snapKey are what decide a save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (snapNeeded) saveSnap(); }, [snapKey, snapNeeded]);
  return (
    <div style={css('display: flex; flex-direction: column; gap: 20px; min-width: 0;')}>
      <UndoBanner w={w} />
      <Tiles w={w} />
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 16px; align-items: start;')}>
        <Attention w={w} />
        <DueChart w={w} />
      </div>
      <Pipeline w={w} />
      <Team w={w} />
      <Assignments w={w} />
      <Workflow w={w} />
    </div>
  );
}
