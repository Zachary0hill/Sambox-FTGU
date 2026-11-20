'use client';
// Ideas & Research: the browsing toolbar, the workflow board and the idea detail dialog.
// Built from handoff/ideas-research-handoff-2026-11-19 (HANDOFF.md, screenshots/State-Board-1440.png, MainCompact.png).
// Values come from lib/studio/vals-ideas.js (V.ids.tb, V.ids.board, V.ids.sel); hover, focus and narrow-screen rules
// live in the .ir-* block of app/globals.css.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import FocusDialog from './FocusDialog';
import { Popover, MenuRow, MenuLabel, Divider, Segmented, Field, SwatchList, Icon, IC } from './Prims';
import { ScoreSliders } from './IdeaResearch';

const I = {
  funnel: 'M2.5 3.5h11L9.3 8.5v4l-2.6 1.2V8.5z',
  sliders: 'M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6M10 3v3M6 10v3',
  down: 'M8 3v10M4 9l4 4 4-4',
  up: 'M8 13V3M4 7l4-4 4 4',
  grid: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  board: 'M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v9h-3z',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  image: 'M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10.5 6.5h.01',
  pencil: 'M10.5 2.5l3 3-7.5 7.5H3v-3z',
  spark: 'M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3z',
  clock: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 5v3l2 1.5',
  warn: 'M8 2.5l6 10.5H2zM8 6.5v3M8 11.5h.01',
  comment: 'M2.5 3.5h11v7.5H6l-3.5 2.5z',
  arrow: 'M3 8h10M9 4l4 4-4 4',
  chevL: 'M10 4L6 8l4 4',
  undo: 'M6 4L2.5 7.5 6 11M3 7.5h7a3.5 3.5 0 0 1 0 7H8',
  pause: 'M5.5 3.5v9M10.5 3.5v9'
};

const SR = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;';
const CTRL = 'display: inline-flex; align-items: center; gap: 8px; flex: none; height: 36px; padding: 0 12px; box-sizing: border-box; border-width: 1px; border-style: solid; border-color: var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; letter-spacing: normal; white-space: nowrap; cursor: pointer;';
const LABEL = 'margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);';
const dotS = (c, n) => 'width: ' + (n || 8) + 'px; height: ' + (n || 8) + 'px; flex: none; border-radius: 999px; background: ' + c + ';';

// Popover anchor. Under 820px the popover becomes a bottom sheet (.ir-anchor in globals.css).
function Anchor({ open, children, grow }) {
  return <span className="ir-anchor" style={css('position: relative; display: inline-flex; min-width: 0;' + (grow ? ' flex: 1 1 160px;' : ' flex: none;') + (open ? ' z-index: 30;' : ''))}>{children}</span>;
}

// Toolbar levels (handoff § Responsive rules): 0 full row, 1 status dropdown, 2 Sort and Display in More,
// 3 Search, Filters and More only. The canvas breakpoints assumed its own control widths and shell, so the row is
// measured instead: when the controls do not fit at their content widths (the search box at its 120px minimum), the
// next level is tried before paint. A width change starts again from the full row.
function useLevel(ref, rowRef) {
  const [level, setLevel] = useState(0);
  const width = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - width.current) < 1) return;
      width.current = w;
      setLevel(0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  // Runs after every render and stops at level 3, so it settles within three passes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const row = rowRef && rowRef.current;
    if (row && level < 3 && row.scrollWidth > row.clientWidth + 1) setLevel(level + 1);
  });
  return level;
}

function StatusTabs({ st }) {
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const n = st.options.findIndex((o) => o.on);
    const to = st.options[(n + (e.key === 'ArrowRight' ? 1 : st.options.length - 1)) % st.options.length];
    e.preventDefault(); to.pick();
    const btns = e.currentTarget.querySelectorAll('button');
    const el = btns[st.options.indexOf(to)];
    if (el) el.focus();
  };
  return (
    <div role="group" aria-label="Status" onKeyDown={onKey} style={css('display: inline-flex; flex: none; height: 36px; box-sizing: border-box; padding: 3px; gap: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface)')}>
      {st.options.map((o) => (
        <button key={o.key} type="button" className="fb-seg" aria-pressed={o.on} onClick={o.pick}
          style={css('display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 6px; font-size: 13px; font-weight: 600; letter-spacing: normal; white-space: nowrap; cursor: pointer; ' + (o.on ? 'background: var(--ink); color: var(--page);' : 'background: transparent; color: var(--ink-3);'))}>
          {o.label}<span style={css('font-weight: 500; font-variant-numeric: tabular-nums; ' + (o.on ? '' : 'color: var(--muted);'))}>{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function StatusMenu({ st, close }) {
  return (
    <Popover label="Status" role="menu" onClose={close} width={232}>
      {st.options.map((o) => (
        <MenuRow key={o.key} role="menuitemradio" aria-checked={o.on} checked={o.on} label={o.label} meta={o.count} onClick={o.pick} />
      ))}
    </Popover>
  );
}

function ViewsMenu({ v, close }) {
  return (
    <Popover label="Saved views" role="menu" onClose={close} width={272}>
      <MenuLabel>Saved views</MenuLabel>
      {v.rows.map((r) => (
        <MenuRow key={r.key} role="menuitemradio" aria-checked={r.on} checked={r.on} onClick={r.pick}>
          <span aria-hidden="true" style={css(dotS(r.color))}></span>
          <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{r.label}</span>
          <span style={css('font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums')}>{r.count}</span>
        </MenuRow>
      ))}
      {v.saved.length ? (
        <>
          <Divider />
          <MenuLabel>Your views</MenuLabel>
          {v.saved.map((r) => v.managing
            ? <MenuRow key={r.key} danger icon={IC.trash} label={'Remove ' + r.label} aria-label={r.removeLabel} onClick={r.remove} />
            : <MenuRow key={r.key} role="menuitemradio" aria-checked={r.on} checked={r.on} onClick={r.pick}>
                <span aria-hidden="true" style={css(dotS('var(--link)'))}></span>
                <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{r.label}</span>
              </MenuRow>)}
          <Divider />
          <MenuRow label={v.managing ? 'Done managing' : 'Manage views'} onClick={v.manage} />
        </>
      ) : null}
    </Popover>
  );
}

function FiltersPanel({ f, close, sheet }) {
  return (
    <Popover label="Filters" onClose={close} align="right" width={400} pad={0} maxH={sheet ? 640 : 560}>
      <div style={css('display: flex; flex-direction: column; min-height: 0')}>
        <div style={css('display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 12px; border-bottom: 1px solid var(--line)')}>
          <div style={css('display: flex; align-items: baseline; justify-content: space-between')}>
            <h2 style={css('margin: 0; font-size: 14px; font-weight: 700; color: var(--ink)')}>Filters</h2>
            <span style={css('font-size: 12px; color: var(--muted)')}>{f.count ? f.count + ' active' : 'None active'}</span>
          </div>
          {f.chips.length ? (
            <div style={css('display: flex; flex-wrap: wrap; gap: 6px')}>
              {f.chips.map((c) => (
                <span key={c.key} style={css('display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 28px; padding: 0 4px 0 10px; box-sizing: border-box; border: 1px solid var(--link); border-radius: 8px; background: var(--accent-soft); font-size: 12px; color: var(--ink-3)')}>
                  <span style={css('white-space: nowrap')}>{c.group}</span>
                  <strong style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: var(--ink)')}>{c.value}</strong>
                  <button type="button" className="fb-ni" aria-label={c.removeLabel} onClick={c.remove} style={css('width: 22px; height: 22px; flex: none; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.x} size={12} sw={2} /></button>
                </span>
              ))}
            </div>
          ) : <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>No filters applied</p>}
        </div>
        <div style={css('overflow-y: auto; max-height: ' + (sheet ? '46vh' : '400px') + '; padding: 4px 0')}>
          {f.groups.map((g) => (
            <fieldset key={g.key} style={css('margin: 0; padding: 10px 16px 12px; border: 0; border-bottom: 1px solid var(--line); min-width: 0')}>
              <legend style={css('float: left; width: 100%; display: flex; justify-content: space-between; padding: 0 0 8px; ' + LABEL)}>
                <span>{g.label}</span><span style={css('font-size: 12px; font-weight: 500; letter-spacing: normal; text-transform: none; color: var(--muted)')}>Any of</span>
              </legend>
              <div style={css('clear: both; display: flex; flex-wrap: wrap; gap: 6px')}>
                {g.options.map((o) => (
                  <button key={o.key} type="button" className="ir-opt" aria-pressed={o.on} onClick={o.toggle}
                    style={css('display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; box-sizing: border-box; border-radius: 8px; font-size: 13px; font-weight: 600; letter-spacing: normal; white-space: nowrap; cursor: pointer; ' + (o.on ? 'border: 1px solid var(--link); background: var(--accent-soft); color: var(--ink);' : 'border: 1px solid var(--border); background: var(--surface); color: var(--ink-3);'))}>
                    {o.on ? <Icon d={IC.check} size={13} sw={2} style="flex: none; color: var(--link)" /> : null}
                    {o.dot ? <span aria-hidden="true" style={css(dotS(o.dot, 7))}></span> : null}
                    {o.label}
                  </button>
                ))}
                {!g.options.length ? <span style={css('font-size: 13px; color: var(--muted)')}>No owners in scope</span> : null}
              </div>
            </fieldset>
          ))}
        </div>
        <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--line)')}>
          {f.saving ? (
            <>
              <label htmlFor="iff-save" style={css(SR)}>Name this view</label>
              <input id="iff-save" type="text" autoComplete="off" autoFocus placeholder="Name this view" value={f.saveName} onChange={f.onSaveName} onKeyDown={f.onSaveKey}
                style={css('flex: 1 1 140px; min-width: 0; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--link); border-radius: 8px; background: var(--panel); font-size: 13px; color: var(--ink)')} />
              <button type="button" onClick={f.save} disabled={!f.saveName.trim()} style={css(CTRL + 'border-color: var(--link); color: var(--ink);' + (f.saveName.trim() ? '' : ' opacity: 0.5; cursor: default;'))}>Save</button>
              <button type="button" className="fb-ni" onClick={f.cancelSave} style={css(CTRL + 'border-color: transparent; background: transparent;')}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className="fb-ni" onClick={f.clearAll} disabled={!f.count} style={css('height: 36px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; font-size: 13px; font-weight: 600; color: ' + (f.count ? 'var(--ink)' : 'var(--faint)') + '; cursor: ' + (f.count ? 'pointer' : 'default'))}>Clear all</button>
              <span style={css('flex: 1')}></span>
              <button type="button" onClick={f.startSave} disabled={!f.canSave} style={css(CTRL + 'border-color: var(--link); background: transparent; color: var(--link);' + (f.canSave ? '' : ' opacity: 0.45; cursor: default;'))}>Save as view</button>
              <button type="button" onClick={f.done} style={css(CTRL + 'border-color: var(--ink); background: var(--ink); color: var(--page);')}>Done</button>
            </>
          )}
        </div>
      </div>
    </Popover>
  );
}

function SortRows({ s }) {
  return (
    <>
      <MenuLabel>Sort by</MenuLabel>
      {s.rows.map((r) => <MenuRow key={r.key} checked={r.on} aria-pressed={r.on} label={r.label} onClick={r.pick} />)}
      <div style={css('padding: 8px 10px 6px')}>
        <Segmented label="Order" options={s.dirs} value={s.dir} onChange={s.pickDir} size="sm" />
      </div>
    </>
  );
}

function DisplayRows({ d }) {
  return (
    <>
      <MenuLabel actionText={d.reset ? 'Reset' : ''} onAction={d.reset}>{d.title}<span style={css('margin-left: 8px; font-weight: 500; color: var(--muted)')}>{d.meta}</span></MenuLabel>
      {d.items.map((x) => (
        <MenuRow key={x.key} toggle={x.on} label={x.label} onClick={x.flip} />
      ))}
      {d.groups ? (
        <>
          <Divider />
          <MenuLabel>Group by</MenuLabel>
          {d.groups.map((g) => <MenuRow key={g.key} checked={g.on} aria-pressed={g.on} label={g.label} onClick={g.pick} />)}
        </>
      ) : null}
    </>
  );
}

function LayoutSwitch({ layouts, labels }) {
  return (
    <div role="group" aria-label="Layout" style={css('display: inline-flex; flex: none; height: 36px; box-sizing: border-box; padding: 3px; gap: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface)')}>
      {layouts.map((l) => (
        <button key={l.key} type="button" className="fb-seg" aria-pressed={l.on} aria-label={labels ? undefined : l.name} title={l.name} onClick={l.pick}
          style={css('display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 28px; height: 28px; padding: 0 ' + (labels ? 10 : 0) + 'px; border: 0; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; ' + (l.on ? 'background: var(--ink); color: var(--page);' : 'background: transparent; color: var(--ink-3);'))}>
          <Icon d={I[l.key === 'gallery' ? 'grid' : l.key]} />{labels ? l.label : null}
        </button>
      ))}
    </div>
  );
}

export function IdeasToolbar({ t }) {
  const ref = useRef(null);
  const rowRef = useRef(null);
  const level = useLevel(ref, rowRef);
  const m = t.menu;
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 819px)');
    const on = () => setSheet(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const v = t.views, f = t.filters, so = t.sort;
  return (
    <div ref={ref} role="group" aria-label="Browse ideas" className="ir-tb" style={css('display: flex; align-items: center; gap: 8px; min-width: 0')}>
      <div ref={rowRef} style={css('flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px')}>
        {level === 0 ? <StatusTabs st={t.status} /> : null}
        {level === 1 || level === 2 ? (
          <Anchor open={m === 'status'}>
            <button type="button" aria-haspopup="menu" aria-expanded={m === 'status'} onClick={() => t.toggle('status')} style={css(CTRL)}>
              {t.status.label}<span style={css('font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums')}>{t.status.count}</span><Icon d={IC.chevD} size={14} />
            </button>
            {m === 'status' ? <StatusMenu st={t.status} close={t.close} /> : null}
          </Anchor>
        ) : null}
        {level < 3 ? (
          <Anchor open={m === 'views'}>
            <button type="button" aria-haspopup="menu" aria-expanded={m === 'views'} onClick={() => t.toggle('views')} style={css(CTRL + ' max-width: 220px;')}>
              <span aria-hidden="true" style={css(dotS(v.color))}></span>
              <span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis')}>{v.name}</span>
              {v.edited ? <><span aria-hidden="true" style={css(dotS('var(--link)', 6))}></span><span style={css(SR)}>edited</span></> : null}
              <Icon d={IC.chevD} size={14} />
            </button>
            {m === 'views' ? <ViewsMenu v={v} close={t.close} /> : null}
          </Anchor>
        ) : null}
        <div className="ir-search" style={css('position: relative; flex: 1 1 160px; min-width: 120px; display: flex; align-items: center')}>
          <Icon d={IC.search} style="position: absolute; left: 11px; color: var(--muted); pointer-events: none" />
          <label htmlFor="idea-search" style={css(SR)}>Search ideas by title or hook</label>
          <input id="idea-search" type="search" autoComplete="off" placeholder="Search ideas" value={t.search.value} onChange={t.search.onChange}
            style={css('width: 100%; height: 36px; box-sizing: border-box; padding: 0 30px 0 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 13px; color: var(--ink)')} />
          <kbd className="ir-kbd" aria-hidden="true" style={css('position: absolute; right: 8px; height: 20px; min-width: 20px; box-sizing: border-box; padding: 0 5px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 5px; font: inherit; font-size: 11px; color: var(--muted)')}>/</kbd>
        </div>
        <Anchor open={m === 'filters'}>
          <button type="button" aria-haspopup="dialog" aria-expanded={m === 'filters'} aria-label={f.label} onClick={() => t.toggle('filters')} style={css(CTRL + (f.count ? ' border-color: var(--link);' : ''))}>
            <Icon d={I.funnel} />Filters
            {f.count ? <span aria-hidden="true" style={css('min-width: 18px; height: 18px; box-sizing: border-box; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--link); color: var(--page); font-size: 11px; font-weight: 800')}>{f.count}</span> : null}
          </button>
          {m === 'filters' ? <FiltersPanel f={f} close={t.close} sheet={sheet} /> : null}
        </Anchor>
      </div>
      <div style={css('flex: none; display: flex; align-items: center; gap: 8px')}>
        {level < 2 ? (
          <>
            <Anchor open={m === 'sort'}>
              <button type="button" aria-haspopup="dialog" aria-expanded={m === 'sort'} aria-label={so.label} onClick={() => t.toggle('sort')} style={css(CTRL)}>
                <span style={css('font-weight: 500; color: var(--muted)')}>Sort:</span>{so.field}<Icon d={so.down ? I.down : I.up} size={14} />
              </button>
              {m === 'sort' ? <Popover label="Sort" onClose={t.close} align="right" width={240}><SortRows s={so} /></Popover> : null}
            </Anchor>
            <Anchor open={m === 'display'}>
              <button type="button" aria-haspopup="dialog" aria-expanded={m === 'display'} onClick={() => t.toggle('display')} style={css(CTRL)}>
                <Icon d={I.sliders} />Display
              </button>
              {m === 'display' ? <Popover label="Display" onClose={t.close} align="right" width={300}><DisplayRows d={t.display} /></Popover> : null}
            </Anchor>
          </>
        ) : null}
        {level < 3 ? <LayoutSwitch layouts={t.layouts} /> : null}
        {level >= 2 ? (
          <Anchor open={m === 'more'}>
            <button type="button" aria-label="More options" aria-haspopup="menu" aria-expanded={m === 'more'} onClick={() => t.toggle('more')} style={css(CTRL + ' width: 36px; padding: 0; justify-content: center;')}>
              <Icon d={IC.more} sw={2.4} />
            </button>
            {m === 'more' ? (
              <Popover label="More options" onClose={t.close} align="right" width={300} maxH={560}>
                {level === 3 ? (
                  <>
                    <MenuLabel>Status</MenuLabel>
                    {t.status.options.map((o) => <MenuRow key={o.key} role="menuitemradio" aria-checked={o.on} checked={o.on} label={o.label} meta={o.count} onClick={o.pick} />)}
                    <Divider />
                    <MenuLabel>Saved view</MenuLabel>
                    {v.rows.concat(v.saved).map((r) => <MenuRow key={r.key} role="menuitemradio" aria-checked={r.on} checked={r.on} label={r.label} meta={r.count} onClick={r.pick} />)}
                    <Divider />
                    <MenuLabel>Layout</MenuLabel>
                    <div style={css('padding: 4px 10px 8px')}><LayoutSwitch layouts={t.layouts} labels /></div>
                    <Divider />
                  </>
                ) : null}
                <SortRows s={so} />
                <Divider />
                <DisplayRows d={t.display} />
              </Popover>
            ) : null}
          </Anchor>
        ) : null}
      </div>
    </div>
  );
}

export function CoverNotice({ c }) {
  return (
    <div role="status" style={css('display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 4px 4px 4px 12px; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--amber-ink) 22%, transparent); border-radius: 8px; background: var(--amber-soft); color: var(--amber-ink); font-size: 13px; font-weight: 600')}>
      <Icon d={I.image} />
      <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{c.text}</span>
      {c.busy
        ? <span aria-hidden="true" className="ir-pulse" style={css(dotS('var(--amber-ink)') + ' margin-right: 10px;')}></span>
        : <button type="button" onClick={c.run} style={css(CTRL + 'height: 32px; border-color: color-mix(in srgb, var(--amber-ink) 30%, transparent); background: var(--surface);')}>Generate covers</button>}
    </div>
  );
}

// ---------- Board ----------

// The board fills what is left of the viewport (min 560px); each lane's list scrolls under its fixed header.
function useFill(ref) {
  const [h, setH] = useState(0);
  // Measured after every render (content above the board can grow); the 1px guard stops the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowY; if (o === 'auto' || o === 'scroll') break; sc = sc.parentElement; }
    const box = sc && sc !== document.body ? sc : null;
    const top = el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top - box.scrollTop : -window.scrollY);
    const view = box ? box.clientHeight : window.innerHeight;
    const next = Math.max(560, Math.round(view - top - 32));
    if (Math.abs(next - h) > 1) setH(next);
  });
  useEffect(() => {
    const on = () => setH(0);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

function RunPill({ run, overlay }) {
  return (
    <span style={css('display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; ' + run.style + (overlay ? ' box-shadow: 0 0 0 1px rgba(0,0,0,0.2);' : ''))}>
      {run.key === 'queued' ? <Icon d={I.clock} size={12} sw={1.8} /> : run.key === 'running' ? <span aria-hidden="true" className="ir-pulse" style={css(dotS('currentColor', 6))}></span> : <Icon d={IC.check} size={12} sw={2} />}
      {run.label}
    </span>
  );
}

function OriginTag({ c, overlay }) {
  return (
    <span style={css('display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; font-weight: 700; white-space: nowrap; ' + (overlay ? 'height: 24px; padding: 0 8px; border-radius: 999px; background: rgba(10,11,13,0.72); color: #F4F4F5;' : c.ai ? 'color: var(--violet-ink);' : 'color: var(--ink-3);'))}>
      <Icon d={c.ai ? I.spark : I.pencil} size={13} />{c.originLabel}
    </span>
  );
}

function Card({ c, dragEnd }) {
  const click = (e) => { if (e.target.closest('button, a, input, textarea')) return; c.open(); };
  return (
    <li style={css('list-style: none')}>
      <article className={'ir-card' + (c.isOpen ? ' ir-card-open' : '')} draggable={c.canDrag ? 'true' : 'false'} onDragStart={c.dragStart} onDragEnd={dragEnd} onClick={click}
        style={css('position: relative; display: flex; flex-direction: column; border: 1px solid ' + (c.isOpen ? 'var(--link)' : 'var(--card-border)') + '; border-radius: 12px; background: var(--surface); overflow: hidden; cursor: ' + (c.canDrag ? 'grab' : 'pointer') + '; transition: border-color .12s ease, opacity .12s ease;' + (c.dragging ? ' opacity: 0.4;' : ''))}>
        {c.media ? (
          <div style={css('position: relative; aspect-ratio: 3 / 1; ' + c.mediaStyle)}>
            {c.showOrigin ? <span style={css('position: absolute; top: 8px; left: 8px')}><OriginTag c={c} overlay /></span> : null}
            {c.run ? <span style={css('position: absolute; top: 8px; right: 8px')}><RunPill run={c.run} overlay /></span> : null}
          </div>
        ) : c.showStrip ? (
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 30px; padding: 0 8px 0 14px; ' + (c.ai ? 'background: var(--violet-soft);' : 'background: var(--surface-2);'))}>
            {c.showOrigin ? <OriginTag c={c} /> : <span></span>}
            {c.run ? <RunPill run={c.run} /> : null}
          </div>
        ) : null}
        <div style={css('display: flex; flex-direction: column; gap: 6px; padding: 14px')}>
          {c.kicker ? <p style={css('margin: 0; font-size: 12px; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{c.kicker}</p> : null}
          <h3 style={css('margin: 0; font-size: 16px; line-height: 21px; font-weight: 600; letter-spacing: -0.01em')}>
            <button type="button" data-open-id={c.id} onClick={c.open} className="ir-title"
              style={css('display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; width: 100%; padding: 0; border: 0; background: transparent; font: inherit; line-height: inherit; letter-spacing: inherit; text-align: left; color: var(--ink); cursor: pointer')}>{c.title}</button>
          </h3>
          {c.context ? <p style={css('margin: 0; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{c.context}</p> : null}
          {c.failed ? (
            <div style={css('display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 6px 6px 6px 10px; border: 1px solid color-mix(in srgb, var(--red-ink) 30%, transparent); border-radius: 8px; background: var(--red-soft); color: var(--red-ink); font-size: 12px; font-weight: 700')}>
              <Icon d={I.warn} size={14} />
              <span style={css('flex: 1; min-width: 0')}><span className="ir-fail-long">Research run failed</span><span className="ir-fail-short">Run failed</span></span>
              {c.retry ? <button type="button" aria-label={c.retryLabel} onClick={c.retry} style={css('flex: none; height: 26px; padding: 0 10px; border: 1px solid color-mix(in srgb, var(--red-ink) 35%, transparent); border-radius: 6px; background: transparent; color: var(--red-ink); font-size: 12px; font-weight: 700; cursor: pointer')}>Retry</button> : null}
            </div>
          ) : null}
          {c.review ? (
            <div style={css('display: flex; gap: 6px; margin-top: 8px')}>
              {c.canApprove ? <button type="button" aria-label={c.approveLabel} onClick={c.approve} className="ir-cbtn" style={css('flex: 1 1 auto; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 700; cursor: pointer')}>Approve</button> : null}
              <button type="button" aria-label={c.returnLabel} onClick={c.ret} className="ir-cbtn" style={css('flex: 1 1 auto; height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer')}>Return</button>
              <button type="button" aria-label={c.parkLabel} onClick={c.park} className="ir-cbtn" style={css('flex: 1 1 auto; height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer')}>Park</button>
            </div>
          ) : null}
          {c.unpark ? <button type="button" aria-label={c.unparkLabel} onClick={c.unpark} className="ir-cbtn" style={css('align-self: flex-start; height: 32px; margin-top: 6px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer')}>{c.unparkText}</button> : null}
          <div style={css('display: flex; align-items: center; gap: 8px; min-height: 28px; margin-top: 8px')}>
            {c.brand ? (
              <span style={css('flex: 1 1 auto; min-width: 72px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink-3); overflow: hidden')}>
                <span aria-hidden="true" style={css(dotS(c.brandColor))}></span><span style={css('min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{c.brand}</span>
              </span>
            ) : <span style={css('flex: 1')}></span>}
            {c.score ? <span title={c.scoreLabel} style={css('flex: none; display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 6px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; ' + c.scoreStyle)}><span style={css(SR)}>{c.scoreLabel}</span><span aria-hidden="true">{c.score}</span></span> : null}
            {c.comments ? <span style={css('flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--muted)')}><Icon d={I.comment} size={13} /><span style={css(SR)}>{c.commentsLabel}</span><span aria-hidden="true">{c.comments}</span></span> : null}
            {c.owner ? <span role="img" aria-label={c.ownerLabel} title={c.ownerLabel} style={css('flex: none; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 11px; font-weight: 700')}>{c.owner}</span> : null}
            {c.canMove ? (
              <button type="button" className="ir-move" aria-label={c.moveLabel} title={c.moveLabel} onClick={c.move}
                style={css('flex: none; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
                <Icon d={I.arrow} size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

// Lane options: every lane collapses; side lanes (On Hold and custom columns) also rename, recolour and delete.
function LaneOptions({ l, dark }) {
  return (
    <Popover label={l.optionsLabel} role={l.canEdit ? 'dialog' : 'menu'} onClose={l.closeMenu} align="right" width={248} maxH={520}>
      {l.canEdit ? (
        <>
          <div style={css('padding: 6px 6px 4px')}>
            <Field id={l.nameId} label="Name" size="sm" maxLength={40} autoComplete="off" value={l.name} onChange={l.onName} onKeyDown={l.onNameKey} />
          </div>
          <SwatchList layout="grid" label="Color" value={l.tone} onChange={l.pickTone} dark={dark} />
          <Divider />
          <MenuRow icon={IC.check} label="Rename" onClick={l.saveName} />
        </>
      ) : <MenuLabel>{l.label}</MenuLabel>}
      <MenuRow icon={IC.chevD} label="Collapse" onClick={l.collapse} />
      {l.canEdit ? <MenuRow danger icon={IC.trash} label={l.deleting ? 'Confirm delete' : 'Delete'} onClick={l.del} /> : null}
      <p style={css('margin: 4px 10px 6px; font-size: 12px; line-height: 1.45; color: var(--muted)')}>{l.note}</p>
    </Popover>
  );
}

function AddColumn({ a }) {
  if (!a.open) {
    return (
      <button type="button" className="fb-ni" onClick={a.start}
        style={css('flex: 0 0 44px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 14px 0; border: 1px dashed var(--border-3); border-radius: 16px; background: transparent; color: var(--ink-3); cursor: pointer')}>
        <Icon d={IC.plus} />
        <span style={css('writing-mode: vertical-rl; font-size: 12px; font-weight: 600; white-space: nowrap')}>Add column</span>
      </button>
    );
  }
  return (
    <div style={css('flex: 0 0 200px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px dashed var(--link); border-radius: 16px; background: var(--panel)')}>
      <label htmlFor="ir-addcol" style={css(SR)}>New column name</label>
      <input id="ir-addcol" type="text" autoFocus autoComplete="off" maxLength={40} placeholder="Column name" value={a.name} onChange={a.onName} onKeyDown={a.onKey}
        style={css('width: 100%; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 13px; color: var(--ink)')} />
      <div style={css('display: flex; gap: 6px')}>
        <button type="button" onClick={a.add} disabled={!a.canAdd} style={css('flex: 1; height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 8px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 700; cursor: pointer;' + (a.canAdd ? '' : ' opacity: 0.45; cursor: default;'))}><Icon d={IC.check} size={14} sw={2} />Add</button>
        <button type="button" className="fb-ni" aria-label="Cancel adding a column" onClick={a.cancel} style={css('width: 32px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.x} size={14} /></button>
      </div>
    </div>
  );
}

function Lane({ l, board }) {
  const ref = useRef(null);
  // The options popover opens inside the lane, so bring a lane that is partly scrolled out of the board into view.
  useEffect(() => { if (l.menuOpen && ref.current) ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [l.menuOpen]);
  if (l.shut) {
    return (
      <section aria-label={l.aria} onDragOver={l.onOver} onDragLeave={l.onLeave} onDrop={l.onDrop}
        style={css('flex: 0 0 44px; height: 100%; box-sizing: border-box; border: 1px solid ' + (l.over ? 'var(--link)' : 'var(--line)') + '; border-radius: 16px; background: ' + (l.over ? 'color-mix(in srgb, var(--link) 6%, var(--panel))' : 'var(--panel)') + '; overflow: hidden')}>
        <button type="button" aria-label={l.expandLabel} title={l.expandLabel} onClick={l.expand} className="fb-ni"
          style={css('width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 14px 0; border: 0; background: transparent; color: var(--ink-3); cursor: pointer')}>
          <Icon d={IC.chevR} size={14} />
          <span style={css('font-family: var(--font-title); font-weight: 900; font-size: 18px; line-height: 1; font-variant-numeric: tabular-nums; color: ' + l.color)}>{l.count}</span>
          <span style={css('writing-mode: vertical-rl; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap')}>{l.label}</span>
        </button>
      </section>
    );
  }
  return (
    <section ref={ref} aria-label={l.aria} className="ir-lane" onDragOver={l.onOver} onDragLeave={l.onLeave} onDrop={l.onDrop}
      style={css('position: relative; flex: 1 1 0; min-width: 240px; max-width: 380px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; border: 1px solid ' + (l.over ? 'var(--link)' : 'var(--line)') + '; border-radius: 16px; background: var(--panel); transition: border-color .12s ease' + (l.menuOpen ? '; z-index: 5' : ''))}>
      <header style={css('flex: none; display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 14px 12px 14px 16px; box-sizing: border-box; border-bottom: 1px solid var(--line)')}>
        <span aria-hidden="true" style={css('flex: none; font-family: var(--font-title); font-weight: 900; font-size: 40px; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: ' + l.color)}>{l.count}</span>
        <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px')}>
          <h2 style={css('margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{l.label}</h2>
          <p style={css('margin: 0; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{l.desc}</p>
        </div>
        {l.canAdd ? (
          <button type="button" aria-label={l.addLabel} title={l.addLabel} onClick={board.add} className="fb-ni"
            style={css('flex: none; width: 32px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
            <Icon d={IC.plus} />
          </button>
        ) : null}
        {l.canShut ? (
          <div className={'ir-lane-ctl' + (l.menuOpen ? ' ir-lane-ctl-on' : '')} style={css('position: absolute; top: 8px; right: ' + (l.canAdd ? 52 : 8) + 'px; z-index: ' + (l.menuOpen ? 30 : 1) + '; display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--panel)')}>
            <button type="button" className="fb-ni ir-collapse" aria-label={l.collapseLabel} title={l.collapseLabel} onClick={l.collapse}
              style={css('width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.chevD} size={14} /></button>
            <span className="ir-anchor" style={css('position: relative; display: inline-flex')}>
              <button type="button" className="fb-ni" aria-label={l.optionsLabel} title={l.optionsLabel} aria-haspopup="menu" aria-expanded={l.menuOpen} onClick={l.toggleMenu}
                style={css('width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Icon d={IC.more} sw={2.4} size={14} /></button>
              {l.menuOpen ? <LaneOptions l={l} dark={board.dark} /> : null}
            </span>
          </div>
        ) : null}
      </header>
      <div className="ir-list" style={css('flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px; box-sizing: border-box; border-radius: 0 0 15px 15px; display: flex; flex-direction: column; gap: 10px;' + (l.over ? ' background: color-mix(in srgb, var(--link) 4%, transparent);' : ''))}>
        {l.empty ? (
          <p style={css('margin: 0; flex: none; height: 64px; display: flex; align-items: center; justify-content: center; border: 1px dashed ' + (l.over ? 'var(--link)' : 'var(--border-3)') + '; border-radius: 12px; font-size: 13px; font-weight: 500; color: var(--muted)')}>{l.emptyText}</p>
        ) : (
          <ul role="list" aria-label={l.label} style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px')}>
            {l.cards.map((c) => <Card key={c.id} c={c} dragEnd={board.dragEnd} />)}
          </ul>
        )}
        {l.more ? <button type="button" className="fb-ni" onClick={l.showMore} style={css('flex: none; height: 40px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer')}>{l.more}</button> : null}
      </div>
    </section>
  );
}

export function IdeasBoard({ b }) {
  const ref = useRef(null);
  const h = useFill(ref);
  return (
    <div ref={ref} className="ir-board" style={css('display: flex; gap: 10px; overflow-x: auto; overflow-y: hidden; height: ' + (h ? h + 'px' : 'calc(100dvh - 300px)') + '; min-height: 560px; padding-bottom: 2px; box-sizing: border-box' + (b.single ? '; justify-content: flex-start' : ''))}>
      {b.lanes.map((l) => <Lane key={l.key} l={l} board={b} />)}
      {b.addCol ? <AddColumn a={b.addCol} /> : null}
    </div>
  );
}

// ---------- Idea detail dialog ----------

const BOX = 'display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; box-sizing: border-box; border-width: 1px; border-style: solid; border-color: var(--border); border-radius: 12px; background: var(--surface);';
const DBTN = 'display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 16px; box-sizing: border-box; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: normal; white-space: nowrap; cursor: pointer;';
const ICONB = 'width: 36px; height: 36px; flex: none; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';

function InlineField({ fd, amber }) {
  const warn = amber && fd.empty;
  return (
    <div className="ir-field" style={css(BOX + (warn ? ' border-color: color-mix(in srgb, var(--amber-ink) 55%, transparent);' : ''))}>
      <label htmlFor={fd.id} style={css(LABEL)}>{fd.label}</label>
      {fd.canEdit ? (fd.multi
        ? <textarea id={fd.id} rows={4} value={fd.value} placeholder={fd.placeholder} onChange={fd.onChange} onBlur={fd.onBlur}
            style={css('width: 100%; min-height: 72px; box-sizing: border-box; padding: 0; border: 0; background: transparent; font-size: 15px; line-height: 1.55; color: var(--ink); resize: vertical; outline: none')} />
        : <input id={fd.id} type="text" autoComplete="off" value={fd.value} placeholder={fd.placeholder} onChange={fd.onChange} onBlur={fd.onBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={css('width: 100%; box-sizing: border-box; padding: 0; border: 0; background: transparent; font-size: 15px; font-weight: 600; color: var(--ink); outline: none')} />)
        : <p id={fd.id} style={css('margin: 0; font-size: 15px; line-height: 1.55; white-space: pre-line; color: ' + (fd.empty ? 'var(--muted)' : 'var(--ink)'))}>{fd.empty ? fd.placeholder : fd.value}</p>}
    </div>
  );
}

function Checklist({ items }) {
  return (
    <ul style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px')}>
      {items.map((ck) => (
        <li key={ck.label} style={css('display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: ' + (ck.on ? 'var(--ink)' : 'var(--muted)'))}>
          <span aria-hidden="true" style={css('width: 18px; height: 18px; flex: none; box-sizing: border-box; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; ' + (ck.on ? 'background: var(--green-ink); color: var(--page);' : 'border: 1.5px solid var(--border-strong);'))}>
            {ck.on ? <Icon d={IC.check} size={12} sw={2.4} /> : null}
          </span>
          {ck.label}<span style={css(SR)}>{ck.sr}</span>
        </li>
      ))}
    </ul>
  );
}

export function IdeaDialog({ d, onClose, panel }) {
  const closeRef = useRef(null);
  // FocusDialog focuses the first control; the design starts on Close. Child effects run first, so this wins.
  useEffect(() => { if (closeRef.current) closeRef.current.focus({ preventScroll: true }); }, []);
  const doneN = d.ready.filter((r) => r.on).length;
  const primary = d.foot.find((b) => b.primary);
  const postKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); d.post(); } };
  return (
    <>
      <button type="button" aria-label="Close idea details" onClick={onClose} className="ir-scrim" style={css('position: fixed; inset: 0; z-index: 40; border: 0; padding: 0; background: rgba(0,0,0,0.74); cursor: default')}></button>
      <FocusDialog open aria-modal="true" aria-labelledby="idea-title" className="ir-dlg"
        style={css('position: fixed; z-index: 41; top: 40px; left: 50%; transform: translateX(-50%); margin: 0; width: min(1120px, calc(100vw - 48px)); max-height: calc(100dvh - 80px); box-sizing: border-box; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 300px); overflow: hidden; border: 1px solid var(--line-4); border-radius: 18px; background: var(--surface-2); color: var(--ink); box-shadow: 0 30px 80px rgba(0,0,0,0.5)')}>
        <div className="ir-dlg-main" style={css('min-width: 0; min-height: 0; display: flex; flex-direction: column')}>
          <div className="ir-dlg-top" style={css('flex: none; display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 10px 12px 10px 24px; box-sizing: border-box; border-bottom: 1px solid var(--line)')}>
            <span aria-hidden="true" style={css(dotS(d.laneColor))}></span>
            <p style={css('flex: 1; min-width: 0; margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; overflow: hidden; white-space: nowrap')}>
              <span className="ir-crumb" style={css('display: inline-flex; align-items: center; gap: 6px; color: var(--muted)')}>Ideas &amp; Research<Icon d={IC.chevR} size={12} /></span>
              <strong style={css('font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis')}>{d.laneLabel}</strong>
            </p>
            {d.pos ? <span className="ir-pos" style={css('font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap')}>{d.pos}</span> : null}
            <button type="button" className="fb-ni" aria-label="Previous idea" title="Previous idea (K)" disabled={!d.prev} onClick={d.prev || undefined} style={css(ICONB + (d.prev ? '' : ' opacity: 0.4; cursor: default;'))}><Icon d={I.chevL} /></button>
            <button type="button" className="fb-ni" aria-label="Next idea" title="Next idea (J)" disabled={!d.next} onClick={d.next || undefined} style={css(ICONB + (d.next ? '' : ' opacity: 0.4; cursor: default;'))}><Icon d={IC.chevR} /></button>
            {d.canEditIdea ? <button type="button" className="fb-ni" aria-label="Edit idea" title="Edit idea" onClick={d.edit} style={css(ICONB)}><Icon d={I.pencil} /></button> : null}
            {(d.actions || []).filter((a) => a.label !== 'Edit').length ? (
              <span className="ir-anchor" style={css('position: relative; display: inline-flex;' + (d.menuOpen ? ' z-index: 30;' : ''))}>
                <button type="button" className="fb-ni" aria-label="More idea actions" aria-haspopup="menu" aria-expanded={d.menuOpen} onClick={d.toggleMenu} style={css(ICONB)}><Icon d={IC.more} sw={2.4} /></button>
                {d.menuOpen ? (
                  <Popover label="Idea actions" role="menu" onClose={d.closeMenu} align="right" width={240}>
                    {d.actions.filter((a) => a.label !== 'Edit').map((a) => (
                      <MenuRow key={a.label} danger={/delete/i.test(a.label)} label={a.label} onClick={a.pick} />
                    ))}
                  </Popover>
                ) : null}
              </span>
            ) : null}
            <button ref={closeRef} type="button" className="fb-ni" aria-label="Close idea details" title="Close (Esc)" onClick={onClose} style={css(ICONB)}><Icon d={IC.x} /></button>
          </div>
          <div className="ir-dlg-scroll" style={css('flex: 1 1 auto; min-height: 0; overflow-y: auto')}>
            {d.cover ? (
              <div style={css('position: relative; aspect-ratio: 3 / 1; max-height: 240px; ' + d.cover)}>
                {d.replaceCover ? (
                  <div style={css('position: absolute; right: 12px; bottom: 12px; display: flex; gap: 8px')}>
                    <button type="button" onClick={d.replaceCover} style={css('height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: rgba(10,11,13,0.78); color: #F4F4F5; font-size: 13px; font-weight: 600; cursor: pointer')}>Replace cover</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={css('display: flex; flex-direction: column; gap: 12px; padding: 20px 24px 0')}>
              {d.kicker ? <p style={css('margin: 0; font-size: 13px; font-weight: 600; color: var(--muted)')}>{d.kicker}</p> : null}
              <h2 id="idea-title" style={css('margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 22px; line-height: 1.25; letter-spacing: -0.02em; text-wrap: balance')}>{d.title}</h2>
              <div style={css('display: flex; flex-wrap: wrap; gap: 6px')}>
                <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; background: ' + (d.ai ? 'var(--violet-soft); color: var(--violet-ink)' : 'var(--surface); color: var(--ink-2)') + '; font-size: 13px; font-weight: 600')}><Icon d={d.ai ? I.spark : I.pencil} size={13} />{d.originLabel}</span>
                {d.run ? <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 600; ' + d.run.style)}>{d.run.key === 'running' ? <span aria-hidden="true" className="ir-pulse" style={css(dotS('currentColor', 6))}></span> : null}{d.run.label}</span> : null}
                <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink-2)')}><span aria-hidden="true" style={css(dotS(d.brandColor))}></span>{d.brand}</span>
                <span style={css('display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 4px; border-radius: 8px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink-2)')}><span aria-hidden="true" style={css('width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); font-size: 10px; font-weight: 700')}>{d.ownerIni}</span>{d.ownerName}</span>
              </div>
              <ol aria-label="Stage" style={css('margin: 0; padding: 0; list-style: none; display: flex; align-items: flex-end; gap: 6px')}>
                {d.progress.map((p) => (
                  <li key={p.key} aria-current={p.current ? 'step' : undefined} style={css('flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 6px')}>
                    <span style={css('font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ' + (p.current ? 'var(--ink)' : p.on ? 'var(--ink-3)' : 'var(--muted)'))}>{p.label}</span>
                    <span aria-hidden="true" style={css('height: 4px; border-radius: 999px; background: ' + (p.on ? d.laneColor : 'var(--border)'))}></span>
                  </li>
                ))}
                {d.extraChip ? <li style={css('flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border: 1px solid var(--border-3); border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--ink-3)')}>{d.extraChip}</li> : null}
              </ol>
            </div>
            <div role="tablist" aria-label="Idea sections" onKeyDown={d.onTabKey} style={css('display: flex; gap: 4px; margin-top: 12px; padding: 0 24px; border-bottom: 1px solid var(--line); overflow-x: auto; overflow-y: hidden')}>
              {d.tabs.map((t) => (
                <button key={t.id} id={t.id} type="button" role="tab" aria-selected={t.selected} aria-controls={t.panel} tabIndex={t.tabIndex} onClick={t.pick}
                  style={css('flex: none; display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 12px; margin-bottom: -1px; border: 0; border-bottom: 2px solid ' + (t.selected === 'true' ? 'var(--link)' : 'transparent') + '; background: transparent; font-size: 14px; font-weight: ' + (t.selected === 'true' ? 700 : 600) + '; letter-spacing: normal; white-space: nowrap; cursor: pointer; color: ' + (t.selected === 'true' ? 'var(--ink)' : 'var(--ink-3)'))}>
                  {t.label}{t.count ? <span style={css('font-size: 12px; font-weight: 500; color: var(--muted)')}>{t.count}</span> : null}
                </button>
              ))}
            </div>
            <div style={css('padding: 20px 24px 24px')}>
              {d.isOverview ? (
                <div role="tabpanel" id="idp-overview" aria-labelledby="idt-overview" style={css('display: flex; flex-direction: column; gap: 12px')}>
                  <div className="ir-two" style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px')}>
                    <InlineField fd={d.inline[0]} amber />
                    <InlineField fd={d.inline[1]} />
                  </div>
                  <div style={css(BOX)}>
                    <span style={css(LABEL)}>Hook</span>
                    <p style={css('margin: 0; font-size: 15px; font-weight: 600; color: ' + (d.hookSet ? 'var(--ink)' : 'var(--muted)'))}>{d.hook}</p>
                  </div>
                  <InlineField fd={d.concept} />
                  {(d.tags || []).length ? <div style={css('display: flex; flex-wrap: wrap; gap: 6px')}>{d.tags.map((t) => <span key={t} style={css('display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: var(--chip); font-size: 12px; color: var(--ink-3)')}>{t}</span>)}</div> : null}
                  {d.hasNote ? <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>{d.note}</p> : null}
                </div>
              ) : null}
              {d.isComments ? (
                <div role="tabpanel" id="idp-comments" aria-labelledby="idt-comments" style={css('display: flex; flex-direction: column; gap: 16px')}>
                  {d.noComments ? <p style={css('margin: 0; font-size: 14px; color: var(--muted)')}>No comments yet. Ask a question or leave a note for the owner.</p> : null}
                  {(d.comments || []).map((cm, n) => (
                    <div key={n} style={css('display: flex; gap: 12px')}>
                      <span aria-hidden="true" style={css(cm.avatarStyle)}>{cm.initials}</span>
                      <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px')}>
                        <span style={css('display: flex; gap: 8px; align-items: baseline')}><span style={css('font-size: 14px; font-weight: 700')}>{cm.who}</span><span style={css('font-size: 12px; color: var(--muted)')}>{cm.time}</span></span>
                        <p style={css('margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); white-space: pre-line; overflow-wrap: anywhere')}>{cm.text}</p>
                      </div>
                    </div>
                  ))}
                  {d.canComment ? (
                    <div style={css('display: flex; gap: 8px; align-items: flex-end')}>
                      <label htmlFor="idea-comment" style={css(SR)}>Add a comment</label>
                      <textarea id="idea-comment" rows={2} placeholder="Add a comment. Enter posts, Shift + Enter adds a line." value={d.draft} onChange={d.onDraft} onKeyDown={postKey}
                        style={css('flex: 1; min-width: 0; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical')} />
                      <button type="button" onClick={d.post} disabled={!String(d.draft || '').trim()} style={css(DBTN + 'border: 0; background: var(--inv); color: var(--inv-ink);' + (String(d.draft || '').trim() ? '' : ' opacity: 0.45; cursor: default;'))}>Post</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!d.isOverview && !d.isComments ? panel : null}
            </div>
          </div>
          <footer className="ir-dlg-foot" style={css('flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px 12px 24px; border-top: 1px solid var(--line); background: var(--panel)')}>
            {d.foot.map((b) => (
              <button key={b.label} type="button" onClick={b.pick} disabled={b.disabled} aria-describedby={b.primary && b.hint ? 'idea-foot-hint' : undefined}
                style={css(DBTN + (b.primary ? 'border: 0; background: var(--inv); color: var(--inv-ink);' : 'border: 1px solid var(--border); background: var(--surface); color: var(--ink);') + (b.disabled ? ' opacity: 0.45; cursor: default;' : ''))}>{b.label}</button>
            ))}
            {primary && primary.hint && primary.disabled ? <span id="idea-foot-hint" style={css('font-size: 13px; color: var(--ink-3)')}>{primary.hint}</span> : null}
            <span style={css('flex: 1')}></span>
            <button type="button" className="fb-ni" onClick={onClose} style={css(DBTN + 'border: 0; background: transparent; color: var(--ink);')}>Close</button>
            {d.gate ? <p role="alert" style={css('flex: 1 1 100%; margin: 0; font-size: 13px; font-weight: 600; color: var(--red-ink)')}>{d.gate}</p> : null}
          </footer>
        </div>
        <aside aria-label="Idea summary" className="ir-dlg-side" style={css('min-width: 0; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 20px; display: flex; flex-direction: column; gap: 22px; border-left: 1px solid var(--line); background: var(--panel)')}>
          <section aria-labelledby="idea-next" style={css('display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--line-4); border-radius: 12px; background: var(--surface-2)')}>
            <h3 id="idea-next" style={css(LABEL)}>Next step</h3>
            <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-2)')}>{d.nextText}</p>
            {d.showChecklist ? (
              <div style={css('display: flex; flex-direction: column; gap: 10px; padding-top: 10px; border-top: 1px solid var(--line)')}>
                <div style={css('display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 700')}>
                  <span>Ready for review</span>
                  <span style={css('color: ' + (doneN === d.ready.length ? 'var(--green-ink)' : 'var(--amber-ink)'))}>{d.readyLabel}</span>
                </div>
                <Checklist items={d.ready} />
              </div>
            ) : null}
          </section>
          <section aria-labelledby="idea-score" style={css('display: flex; flex-direction: column; gap: 10px')}>
            <h3 id="idea-score" style={css(LABEL)}>Score</h3>
            {d.scored ? (
              <>
                <div style={css('display: flex; align-items: center; gap: 10px')}>
                  <span style={css('font-family: var(--font-title); font-weight: 900; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums')}>{d.score}</span>
                  {d.band ? <span style={css('display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 700; ' + d.bandStyle)}>{d.band}</span> : null}
                </div>
                {d.scoreRows ? <ScoreSliders rows={d.scoreRows} canEdit={d.canScore} onCommit={d.onScore} /> : null}
                {(d.iceBars || []).map((k) => (
                  <div key={k.label} style={css('display: grid; grid-template-columns: 84px minmax(0, 1fr) 20px; align-items: center; gap: 10px; font-size: 13px')}>
                    <span style={css('color: var(--ink-3)')}>{k.label}</span>
                    <span aria-hidden="true" style={css('height: 6px; border-radius: 999px; background: var(--chip-2); overflow: hidden')}><span style={css(k.bar.replace('background: var(--ink)', 'background: ' + d.laneColor))}></span></span>
                    <span style={css('font-weight: 700; text-align: right; font-variant-numeric: tabular-nums')}>{k.value}</span>
                  </div>
                ))}
                {d.recWord ? <p style={css('margin: 0; font-size: 13px; color: var(--ink-3)')}>Research recommends: <strong style={css('color: var(--ink)')}>{d.recWord}</strong></p> : null}
                {d.scoreOverridden ? <span style={css('font-size: 12px; color: var(--muted)')}>Adjusted by hand</span> : null}
                {d.clearScore ? <button type="button" onClick={d.clearScore} style={css('align-self: flex-start; padding: 0; border: 0; background: none; color: var(--muted); font-size: 13px; text-decoration: underline; cursor: pointer')}>Clear score</button> : null}
              </>
            ) : (
              <>
                <p style={css('margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink-3)')}>Not scored yet. A complete research run scores it.</p>
                {d.scoreManually ? <button type="button" onClick={d.scoreManually} style={css(CTRL + 'align-self: flex-start;')}>Score manually</button> : null}
              </>
            )}
          </section>
          <section aria-labelledby="idea-details">
            <h3 id="idea-details" style={css(LABEL + ' margin-bottom: 6px;')}>Details</h3>
            <dl style={css('margin: 0')}>
              {d.details.map((r) => (
                <div key={r.label} style={css('display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px')}>
                  <dt style={css('color: var(--ink-3)')}>{r.label}</dt>
                  <dd style={css('margin: 0; min-width: 0; text-align: right; overflow-wrap: anywhere; font-weight: ' + (r.set ? 700 : 500) + '; color: ' + (r.set ? 'var(--ink)' : 'var(--muted)'))}>{r.value}</dd>
                </div>
              ))}
              <div style={css('display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; font-size: 13px')}>
                <dt style={css('color: var(--ink-3)')}>Converted to</dt>
                <dd style={css('margin: 0; min-width: 0; display: grid; gap: 4px; justify-items: end; text-align: right; overflow-wrap: anywhere')}>
                  {d.noConversions ? <span style={css('color: var(--muted)')}>Not yet</span> : d.conversions.map((x) => x.open
                    ? <button key={x.text} type="button" onClick={x.open} style={css('padding: 0; border: 0; background: none; font-size: 13px; font-weight: 700; color: var(--link); text-align: right; cursor: pointer')}>{x.text}</button>
                    : <span key={x.text} style={css('font-weight: 700')}>{x.text}</span>)}
                  {d.addConversion ? <button type="button" onClick={d.addConversion} style={css('padding: 0; border: 0; background: none; font-size: 13px; font-weight: 600; color: var(--ink-3); text-decoration: underline; cursor: pointer')}>Convert again</button> : null}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </FocusDialog>
    </>
  );
}
