'use client';
// app: the project modal, laid out like the ZZMEDIA dashboard's project card (CardDetailPanel): cover, header with the
// state row, tabs with quick actions beside them, then the tab body next to a Details sidebar. Every value comes from
// lib/studio/vals.js (V.dr); this file only lays it out.
import { Fragment, useEffect, useRef } from 'react';
import { css } from '@/lib/studio/css';

const ICON = {
  status: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  type: 'M8.3 10a.7.7 0 0 1-.6-1l3.7-6.3a.7.7 0 0 1 1.2 0L16.3 9a.7.7 0 0 1-.6 1zM3 14h7v7H3zM17.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  channel: 'M2 7h20v13H2zM17 2l-5 5-5-5',
  job: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  editor: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  designer: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  editStatus: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
  thumb: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2M21 15l-5-5L5 21',
  film: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  thumbDue: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v3l2 1',
  editDue: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v3l2 1',
  pub: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4',
  sponsor: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM2 22h20M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2',
  approval: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  clipping: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', newsletter: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', community: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', distribute: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8M7 7h.01'
};
const I = ({ d, size }) => <svg aria-hidden="true" width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none')}><path d={d}></path></svg>;

const SEC = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 8px;';
const SEC_T = 'display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3);';
const CARD = 'border: 1px solid var(--line-4); border-radius: 14px; background: var(--surface-2); padding: 14px;';
const SR = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;';
const QUICK = 'display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink-2); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;';
const QUICK_P = 'display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: var(--inv); color: var(--inv-ink); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;';
const EMPTY_BTN = 'display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 8px; border: 1px dashed var(--border-strong); border-radius: 8px; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit;';
const LINK_ACT = 'padding: 0; border: 0; background: transparent; font: inherit; font-size: 11px; font-weight: 600; color: var(--muted); text-decoration: underline; text-underline-offset: 2px; cursor: pointer;';

function Section({ icon, title, action, children }) {
  return (
    <section style={css('display: flex; flex-direction: column')}>
      <div style={css(SEC)}>
        <span style={css(SEC_T)}>{icon ? <I d={icon} size={12} /> : null}{title}</span>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function IconBtn({ label, pressed, onClick, hide, style, children }) {
  return (
    <button type="button" className={'fb-ni' + (hide ? ' fb-dlg-x' : '')} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} style={css(style)}>{children}</button>
  );
}

// ---------- Details sidebar ----------
function PropValue({ f }) {
  return (
    <span style={css('min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden; font-size: 12.5px; font-weight: 500; color: var(--ink)')}>
      {f.isText ? <span style={css(f.textStyle)}>{f.text}</span> : null}
      {f.isBlock ? <span style={css(f.blockStyle + ' border-radius: 6px;')}>{f.text}</span> : null}
      {f.isDate ? <span style={css(f.chipStyle + ' border-radius: 8px;')}>{f.text}</span> : null}
      {f.isPerson ? <><span aria-hidden="true" style={css(f.avatarStyle)}>{f.initials}</span><span style={css('white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{f.text}</span></> : null}
      {f.isDot ? <><span aria-hidden="true" style={css(f.dotStyle)}></span><span>{f.text}</span></> : null}
      {f.isLink ? <span style={css('color: var(--link); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{f.text}</span> : null}
      {f.isEmpty && !f.can ? <span style={css('color: var(--faint); font-weight: 400')}>{f.emptyText}</span> : null}
      {f.isEmpty && f.can ? <span style={css(EMPTY_BTN)}><I d="M12 5v14M5 12h14" size={12} />{f.emptyText}</span> : null}
      {f.rel ? <span style={css(f.relStyle + ' white-space: nowrap')}>{f.rel}</span> : null}
    </span>
  );
}

// Short labels so the sidebar gutter reads in one line; the full column name stays in the aria label.
const SHORT = { type: 'Type', editStatus: 'Edit status', editDue: 'Edit due', thumbDue: 'Thumb due', pub: 'Publish date', approval: 'Approval', community: 'Community', film: 'Film date', thumb: 'Thumbnail' };
const ROW = 'display: flex; align-items: flex-start; gap: 12px; width: 100%; min-height: 44px; padding: 8px 6px; box-sizing: border-box; border: 0; border-radius: 10px; background: transparent; font-family: inherit; text-align: left; color: var(--ink); letter-spacing: normal;';
const GUT = 'display: flex; align-items: center; gap: 8px; width: 100px; flex: none; padding-top: 5px; font-size: 12px; font-weight: 500; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
function DetailRow({ f, V, CellPop }) {
  const icon = ICON[f.key] || ICON.tag;
  const gutter = <span style={css(GUT)}><I d={icon} /><span style={css('overflow: hidden; text-overflow: ellipsis')}>{SHORT[f.key] || f.label}</span></span>;
  return (
    <div style={css('position: relative; border-bottom: 1px solid var(--line)')}>
      {f.isLink && !f.isOpen ? (
        <div style={css(ROW)}>
          {gutter}
          <span style={css('min-width: 0; flex: 1; display: flex; align-items: center; gap: 4px; min-height: 28px')}>
            {f.text ? <a href={f.href || '#'} target={f.href ? '_blank' : undefined} rel="noopener noreferrer" style={css(f.linkStyle + ' font-size: 12.5px;')}><span style={css('overflow: hidden; text-overflow: ellipsis')}>{f.text}</span></a> : null}
            {!f.text && f.can ? <button type="button" onClick={f.open} style={css(EMPTY_BTN)}><I d="M12 5v14M5 12h14" size={12} />{f.emptyText}</button> : null}
            {!f.text && !f.can ? <span style={css('font-size: 12.5px; color: var(--faint)')}>{f.emptyText}</span> : null}
            {f.text && f.can ? (
              <button type="button" className="fb-ni" aria-label={'Edit ' + f.label} title="Edit link" onClick={f.open} style={css('flex: none; margin-left: auto; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
                <I d="M4 20h4L19 9l-4-4L4 16z" size={13} />
              </button>
            ) : null}
          </span>
        </div>
      ) : f.can ? (
        <button type="button" className="fb-prop" aria-haspopup="dialog" aria-expanded={f.isOpen ? 'true' : 'false'} aria-label={f.aria} onClick={f.open} style={css(ROW + ' cursor: pointer;' + (f.isOpen ? ' background: var(--hover);' : ''))}>
          {gutter}
          <span style={css('min-width: 0; flex: 1; display: flex; align-items: center; min-height: 28px')}><PropValue f={f} /></span>
        </button>
      ) : (
        <div style={css(ROW)}>
          {gutter}
          <span style={css('min-width: 0; flex: 1; display: flex; align-items: center; min-height: 28px')}><PropValue f={f} /></span>
        </div>
      )}
      {f.isOpen ? <CellPop ce={V.ce} popStyle={V.drPop} close={V.closeCell} dark={V.dark} /> : null}
    </div>
  );
}

export function DetailsRail({ V, CellPop }) {
  const dr = V.dr;
  return (
    <div style={css('display: flex; flex-direction: column')}>
      {dr.rail.map((g) => (
        <section key={g.title} aria-label={g.title} style={css('display: flex; flex-direction: column')}>
          <h4 style={css('margin: 14px 6px 2px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-2)')}>{g.title}</h4>
          {g.fields.map((f) => <DetailRow key={f.key} f={f} V={V} CellPop={CellPop} />)}
        </section>
      ))}
    </div>
  );
}

// ---------- Pipeline ----------
function Pipeline({ steps }) {
  return (
    <ol aria-label="Production pipeline" className="fb-dlg-pipe" style={css('margin: 0; padding: 14px 14px 12px; list-style: none; display: grid; grid-template-columns: repeat(' + (steps || []).length + ', minmax(0, 1fr)); ' + CARD + ' padding: 14px 14px 12px;')}>
      {(steps || []).map((st) => (
        <li key={st.label} aria-current={st.current} style={css('position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 12px')}>
          {!st.last ? <span aria-hidden="true" style={css(st.line)}></span> : null}
          <span aria-hidden="true" style={css(st.marker)}></span>
          <span style={css('margin-top: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{st.label}</span>
          <span style={css(st.valueStyle)}>{st.value}</span>
          {st.meta ? <span style={css('font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{st.meta}</span> : null}
        </li>
      ))}
    </ol>
  );
}

// ---------- Comments (on Overview) ----------
function Comments({ V }) {
  const dr = V.dr;
  // Opened from a mention or comment notification: go to the first new comment, else the box at the end of the thread.
  const newRef = useRef(null);
  const boxRef = useRef(null);
  const job = dr.job, jump = dr.jumpToComments;
  useEffect(() => {
    if (!jump) return;
    const el = newRef.current || boxRef.current;
    if (el) el.scrollIntoView({ block: 'center' });
  }, [job, jump]);
  return (
    <Section icon="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" title={'Comments' + (dr.comments.length ? ' · ' + dr.comments.length : '')}>
      <div aria-label="Comments" style={css('display: flex; flex-direction: column; gap: 14px')}>
        <ol style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 16px')}>
          {(dr.comments || []).map((cm, cm__i) => (
            <Fragment key={cm__i}>
            {cm.newStart ? (
              <li ref={newRef} role="separator" aria-label="New since your last visit" style={css('display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; color: var(--blue-ink)')}>
                <span aria-hidden="true" style={css('flex: 1; height: 1px; background: color-mix(in srgb, var(--blue-ink) 30%, transparent)')}></span>
                <span aria-hidden="true">New since your last visit</span>
                <span aria-hidden="true" style={css('flex: 1; height: 1px; background: color-mix(in srgb, var(--blue-ink) 30%, transparent)')}></span>
              </li>
            ) : null}
            <li style={css('display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px')}>
              <span aria-hidden="true" style={css(cm.avatarStyle + ' width: 32px; height: 32px; font-size: 12px;')}>{cm.initials}</span>
              <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
                <div style={css(cm.bubble)}>
                  <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px')}>
                    <span style={css('font-size: 13px; font-weight: 700; color: var(--ink)')}>{cm.who}</span>
                    {cm.roleTag ? <span style={css('display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 5px; background: var(--chip-2); font-size: 10.5px; font-weight: 700; color: var(--ink-3)')}>{cm.roleTag}</span> : null}
                    {cm.internal ? <span style={css(V.internalPill)}>Internal</span> : null}
                    <span style={css('margin-left: auto; font-size: 11px; color: var(--muted-2)')}>{cm.time}{cm.edited ? '  ·  Edited' : ''}</span>
                  </div>
                  {cm.editing ? (
                    <div style={css('display: flex; flex-direction: column; gap: 8px')}>
                      <textarea aria-label="Edit comment" rows="3" autoFocus value={cm.editText} onChange={cm.onEdit} onKeyDown={cm.onEditKey} style={css('width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical')} />
                      <div style={css('display: flex; gap: 8px')}>
                        <button type="button" onClick={cm.saveEdit} style={css(V.ui.ghostSm + ' border: 1px solid var(--ink); color: var(--ink);')}>Save</button>
                        <button type="button" onClick={cm.cancelEdit} style={css(V.ui.ghostSm)}>Cancel</button>
                      </div>
                    </div>
                  ) : cm.hasText ? <p style={css('margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere')}>{cm.parts.map((pt, pt__i) => (pt.mention ? <span key={pt__i} style={css('padding: 0 4px; border-radius: 5px; background: var(--blue-soft); color: var(--blue-ink); font-weight: 600')}>{pt.text}</span> : <Fragment key={pt__i}>{pt.text}</Fragment>))}</p> : null}
                  {cm.hasImages ? (
                    <div style={css(cm.imgGrid)}>
                      {cm.images.map((im) => (
                        <button key={im.key} type="button" aria-label={'Open ' + im.name} onClick={im.open} style={css('display: block; padding: 0; border: 1px solid var(--line-3); border-radius: 12px; overflow: hidden; background: var(--panel); aspect-ratio: 4 / 3; cursor: zoom-in')}>
                          {im.has ? <img src={im.url} alt={im.name} loading="lazy" style={css('width: 100%; height: 100%; object-fit: cover; display: block')} /> : <span style={css('font-size: 12px; color: var(--muted)')}>{im.name}</span>}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {cm.hasFiles ? (
                    <div style={css('display: flex; flex-wrap: wrap; gap: 6px')}>
                      {cm.files.map((f) => (
                        <button key={f.key} type="button" aria-label={'Open ' + f.name} onClick={f.open} style={css('display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 36px; padding: 0 12px 0 8px; border: 1px solid var(--line-3); border-radius: 10px; background: var(--surface); color: var(--ink); cursor: pointer')}>
                          <span style={css(f.badge)}>{f.label}</span>
                          <span style={css('min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{f.name}</span>
                          {f.size ? <span style={css('flex: none; font-size: 12px; color: var(--muted-2)')}>{f.size}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {(cm.canEdit || cm.canDelete) && !cm.editing ? (
                  <span style={css('display: flex; align-items: center; gap: 10px; padding-left: 4px; font-size: 11.5px; color: var(--muted-2)')}>
                    {cm.canEdit ? <button type="button" onClick={cm.startEdit} style={css('padding: 0; border: 0; background: transparent; font: inherit; font-weight: 600; color: var(--ink-3); cursor: pointer')}>Edit</button> : null}
                    {cm.canDelete ? <button type="button" onClick={cm.del} style={css('padding: 0; border: 0; background: transparent; font: inherit; font-weight: 600; color: var(--red-ink); cursor: pointer')}>{cm.delLabel}</button> : null}
                  </span>
                ) : null}
              </div>
            </li>
            </Fragment>
          ))}
        </ol>
        {dr.noComments ? <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>No comments yet. Start the thread below.</p> : null}
        {/* app: comment box. Shows who is posting, takes images and documents, Cmd+Enter posts */}
        <div ref={boxRef} style={css('position: relative; display: flex; flex-direction: column; gap: 6px')}>
          {dr.mention.open ? (
            <ul id="dr-mentions" role="listbox" aria-label="People to mention" style={css('position: absolute; z-index: 6; left: 0; bottom: calc(100% + 4px); width: min(320px, 100%); max-height: 240px; overflow-y: auto; margin: 0; padding: 6px; box-sizing: border-box; list-style: none; background: var(--surface); border: 1px solid var(--line-4); border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,0.16)')}>
              {dr.mention.items.map((p) => (
                // Mouse down, not click: the box keeps focus, so its blur doesn't close the list first.
                <li key={p.id} id={p.id} role="option" aria-selected={p.active} onMouseDown={(e) => { e.preventDefault(); p.pick(); }} style={css('display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px; box-sizing: border-box; border-radius: 8px; cursor: pointer; background: ' + (p.active ? 'var(--hover)' : 'transparent'))}>
                  <span aria-hidden="true" style={css(p.avatarStyle)}>{p.initials}</span>
                  <span style={css('min-width: 0; flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{p.label}</span>
                  {p.sub ? <span style={css('flex: none; max-width: 40%; font-size: 11.5px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{p.sub}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div style={css('display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--muted)')}>
            <span aria-hidden="true" style={css(dr.asAvatar + ' width: 20px; height: 20px; font-size: 9px;')}>{dr.asInitial}</span>
            <span>Commenting as <span style={css('font-weight: 700; color: var(--ink-2)')}>{dr.asName}</span></span>
            <span style={css('margin-left: auto')}>{dr.commentNote}</span>
          </div>
          <div className="fb-composer" style={css('display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); overflow: hidden')}>
            <label htmlFor="dr-comment" style={css(SR)}>Write a comment</label>
            <textarea id="dr-comment" rows={2} disabled={!dr.canComment} placeholder={dr.placeholder} value={dr.draft ?? ''} onChange={dr.onDraft} onKeyDown={dr.onDraftKey} onSelect={dr.mention.onSelect} onBlur={dr.mention.onBlur} aria-autocomplete="list" aria-controls={dr.mention.open ? 'dr-mentions' : undefined} aria-activedescendant={dr.mention.activeId} style={css('width: 100%; min-height: 56px; max-height: 180px; box-sizing: border-box; padding: 10px 12px 6px; border: 0; background: transparent; resize: vertical; font-family: inherit; font-size: 13.5px; line-height: 1.5; color: var(--ink); outline: none')}></textarea>
            {dr.hasPending ? (
              <div style={css('display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 10px 6px')}>
                {(dr.pending || []).map((p) => (
                  <span key={p.key} style={css('display: inline-flex; align-items: center; gap: 6px; max-width: 240px; min-height: 34px; padding: 0 4px; border: 1px solid var(--line-3); border-radius: 10px; background: var(--surface)')}>
                    {p.isImage ? <img src={p.url} alt="" style={css('width: 26px; height: 26px; border-radius: 6px; object-fit: cover; display: block')} /> : <span style={css(p.badge)}>{p.label}</span>}
                    <span style={css('min-width: 0; font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{p.name}</span>
                    <button type="button" aria-label={'Remove ' + p.name} onClick={p.remove} className="fb-ni" style={css('flex: none; width: 26px; height: 26px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><I d="M18 6 6 18M6 6l12 12" size={11} /></button>
                  </span>
                ))}
              </div>
            ) : null}
            <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 6px 6px')}>
              {dr.canAttach ? (
                <button type="button" onClick={dr.attach} className="fb-ni" style={css('min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer')}>
                  <I d="M21.4 11.1 12.2 20.3a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
                  Attach
                </button>
              ) : null}
              {dr.showInternal ? (
                <label style={css('display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 6px; font-size: 12px; color: var(--ink-3); cursor: pointer')}>
                  <input type="checkbox" checked={!!dr.internalOn} onChange={dr.toggleInternal} style={css('width: 14px; height: 14px; margin: 0; accent-color: var(--ink)')} />
                  {' Hide from client '}
                </label>
              ) : null}
              <span style={css('flex: 1')}></span>
              <button type="button" disabled={!dr.canPost} onClick={dr.post} style={css(dr.postStyle + ' min-height: 32px; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600;')}>Post</button>
            </div>
          </div>
          {dr.mention.note ? <p role="status" style={css('margin: 0; font-size: 12px; color: var(--amber-ink)')}>{dr.mention.note}</p> : null}
        </div>
      </div>
    </Section>
  );
}

// ---------- Tabs ----------
function Overview({ V }) {
  const dr = V.dr;
  return (
    <>
      {(dr.steps || []).length ? <Section icon={ICON.type} title="Pipeline"><Pipeline steps={dr.steps} /></Section> : null}
      <Section icon="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" title="Progress">
        <div style={css(CARD)}>
          <div style={css('display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px')}>
            <span style={css('font-size: 12.5px; font-weight: 600; color: var(--ink-2)')}>Project progress</span>
            <span style={css('font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink)')}>{dr.progress.text}</span>
          </div>
          <span role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={dr.progress.pct} style={css('display: block; height: 6px; border-radius: 999px; overflow: hidden; background: var(--chip-2)')}><span style={css(dr.progress.bar)}></span></span>
          <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px')}>
            <span style={css('font-size: 11.5px; color: var(--muted)')}>{dr.progress.note}</span>
            <button type="button" onClick={dr.progress.goTasks} style={css(LINK_ACT)}>Go to tasks</button>
          </div>
        </div>
      </Section>
      {dr.brief.show ? (
        <Section icon="M21 6H3M15 12H3M17 18H3" title="Brief">
          {dr.brief.editing ? (
            <textarea aria-label="Brief" autoFocus rows={5} value={dr.brief.draft} placeholder={dr.brief.placeholder} onChange={dr.brief.onDraft} onKeyDown={dr.brief.onKey} onBlur={dr.brief.save} style={css('width: 100%; min-height: 110px; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--ink); border-radius: 12px; background: var(--surface); font-family: inherit; font-size: 14px; line-height: 1.6; color: var(--ink); resize: vertical; outline: none')}></textarea>
          ) : dr.brief.can ? (
            <button type="button" className="fb-brief" onClick={dr.brief.start} aria-label={dr.brief.has ? 'Edit brief' : 'Add a brief'} title="Click to edit" style={css('display: block; width: 100%; min-height: 76px; box-sizing: border-box; padding: 12px 14px; border: 1px ' + (dr.brief.has ? 'solid var(--line-4)' : 'dashed var(--border-2)') + '; border-radius: 12px; background: transparent; font-family: inherit; font-size: 14px; font-weight: 400; letter-spacing: normal; line-height: 1.6; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; color: ' + (dr.brief.has ? 'var(--ink-2)' : 'var(--faint)') + '; cursor: text')}>{dr.brief.has ? dr.brief.text : 'What is this project, and what does done look like?'}</button>
          ) : (
            <p style={css('margin: 0; padding: 12px 14px; border: 1px solid var(--line-4); border-radius: 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink-2)')}>{dr.brief.text}</p>
          )}
        </Section>
      ) : null}
      {/* app: the project's Social post, sent to Buffer by a Publish to Buffer workflow */}
      {dr.publish && dr.publish.show ? (
        <Section icon="M22 2 11 13M22 2l-7 20-4-9-9-4z" title="Social post">
          <div style={css(CARD + ' display: flex; flex-direction: column; gap: 12px;')}>
            <p style={css('margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--muted)')}>{dr.publish.whenText}</p>
            <label style={css('display: flex; flex-direction: column; gap: 6px')}>
              <span style={css('font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)')}>Caption</span>
              <textarea rows={4} value={dr.publish.caption} onChange={dr.publish.onCaption} onBlur={dr.publish.saveCaption} readOnly={dr.publish.readOnly} placeholder="What the post says on every channel" style={css(V.fieldInput + ' min-height: 96px; padding: 10px 14px; line-height: 1.45; resize: vertical; font-family: inherit; background: var(--surface);')}></textarea>
            </label>
            <div role="group" aria-label="Buffer channels" style={css('display: flex; flex-direction: column; gap: 6px')}>
              <span style={css('font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)')}>Channels</span>
              {dr.publish.noChannels ? <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>{dr.publish.noChannels}</p> : null}
              <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
                {dr.publish.channels.map((c) => <button key={c.id} type="button" aria-pressed={c.on} disabled={dr.publish.readOnly} onClick={c.toggle} style={css(c.style)}>{c.label}</button>)}
              </div>
            </div>
            {dr.publish.showYt ? (
              <label style={css('display: flex; flex-direction: column; gap: 6px')}>
                <span style={css('font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)')}>YouTube title</span>
                <input type="text" maxLength={100} value={dr.publish.ytTitle} placeholder={dr.publish.ytPlaceholder} onChange={dr.publish.onYt} onBlur={dr.publish.saveYt} readOnly={dr.publish.readOnly} style={css(V.fieldInput + ' background: var(--surface);')} />
              </label>
            ) : null}
            <div role="group" aria-label="When to post" style={css('display: flex; flex-direction: column; gap: 6px')}>
              <span style={css('font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)')}>When</span>
              <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px')}>
                {dr.publish.schedules.map((x) => <button key={x.label} type="button" aria-pressed={x.on} disabled={dr.publish.readOnly} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                {dr.publish.isDate ? <input type="time" aria-label="Post time" value={dr.publish.time} onChange={dr.publish.onTime} readOnly={dr.publish.readOnly} style={css(V.fieldInput + ' width: auto; min-height: 36px; background: var(--surface);')} /> : null}
              </div>
              {dr.publish.isDate ? <p style={css('margin: 0; font-size: 12px; color: var(--muted-2)')}>{dr.publish.dateNote}</p> : null}
            </div>
            <p style={css('margin: 0; font-size: 12.5px; color: var(--ink-3)')}>{dr.publish.fileText}</p>
            {dr.publish.history.length ? (
              <ul aria-label="Sent to Buffer" style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column')}>
                {dr.publish.history.map((h) => (
                  <li key={h.id} style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; border-top: 1px solid var(--line)')}>
                    <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px')}>
                      <span style={css(h.textStyle)}>{h.text}</span>
                      <span style={css('font-size: 12px; color: var(--muted-2); overflow-wrap: anywhere')}>{h.sub}</span>
                    </span>
                    {h.canClear ? <button type="button" aria-label={h.clearLabel} onClick={h.clear} style={css(V.ui.ghostSm + ' border: 1px solid var(--border);')}>Allow again</button> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>
      ) : null}
      {dr.filesPeek.show ? (
        <Section icon={ICON.link} title="Latest files" action={dr.filesPeek.more ? <button type="button" onClick={dr.filesPeek.seeAll} style={css(LINK_ACT)}>{dr.filesPeek.more}</button> : null}>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(min(140px, 100%), 1fr)); gap: 10px')}>
            {dr.filesPeek.items.map((fp) => (
              <a key={fp.key} href="#" onClick={fp.open} aria-label={'Open ' + fp.name} style={css('display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--line-4); border-radius: 12px; overflow: hidden; background: var(--surface); color: var(--ink); text-decoration: none')}>
                <span aria-hidden="true" style={css('aspect-ratio: 16 / 10; display: flex; align-items: center; justify-content: center; background: var(--panel); overflow: hidden')}>
                  {fp.hasPreview ? <img src={fp.preview} alt="" loading="lazy" style={css('width: 100%; height: 100%; object-fit: cover; display: block')} /> : <span style={css(fp.badge)}>{fp.typeLabel}</span>}
                </span>
                <span style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px')}>
                  <span style={css('font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{fp.name}</span>
                  <span style={css('font-size: 11.5px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{fp.meta}</span>
                </span>
              </a>
            ))}
            {dr.canUpload ? (
              <button type="button" onClick={dr.upload} style={css('min-height: 112px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px dashed var(--border-2); border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer')}>
                <I d="M12 5v14M5 12h14" />Add file
              </button>
            ) : null}
          </div>
        </Section>
      ) : null}
      <Comments V={V} />
    </>
  );
}

function Tasks({ V }) {
  const dr = V.dr;
  const ck = dr.checklist;
  return (
    <>
      {/* app: Next step and what is waiting, side by side like the dashboard's Next action / Blocked by */}
      <div className="fb-dlg-2up" style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px')}>
        <section style={css('border: 1px solid color-mix(in srgb, var(--blue-ink) 30%, transparent); border-radius: 14px; background: var(--blue-soft); padding: 14px; display: flex; flex-direction: column; gap: 8px')}>
          <span style={css(SEC_T)}><I d="M5 12h14M12 5l7 7-7 7" size={12} />Next step</span>
          {dr.nextStep.has ? (
            <button type="button" onClick={dr.nextStep.pick} style={css('display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--inv); color: var(--inv-ink); font-size: 13.5px; font-weight: 600; cursor: pointer')}>
              {dr.nextStep.label}<I d="M5 12h14M12 5l7 7-7 7" />
            </button>
          ) : null}
          {dr.nextStep.others.map((o) => <button key={o.label} type="button" onClick={o.pick} style={css('width: 100%; min-height: 38px; padding: 0 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 13.5px; font-weight: 600; cursor: pointer')}>{o.label}</button>)}
          {!dr.nextStep.has && !dr.nextStep.others.length ? <p style={css('margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted)')}>No action for you on this project right now.</p> : null}
        </section>
        <section style={css(CARD + ' display: flex; flex-direction: column; gap: 8px;')}>
          <span style={css(SEC_T)}><I d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M4.9 4.9l14.2 14.2" size={12} />Waiting on</span>
          <p style={css('margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink-2)')}>{dr.waitText}</p>
        </section>
      </div>
      {ck && ck.show ? (
        <Section icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" title="Checklist" action={ck.has ? <span style={css('font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--muted-2)')}>{ck.progress}</span> : null}>
          {ck.has ? <span aria-hidden="true" style={css('display: block; height: 6px; border-radius: 999px; overflow: hidden; background: var(--chip-2); margin-bottom: 6px')}><span style={css(ck.bar)}></span></span> : null}
          {ck.empty ? (
            <div style={css('display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 20px; border: 1.5px dashed var(--line-4); border-radius: 16px; text-align: center')}>
              <I d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" size={30} />
              <span style={css('font-size: 15px; font-weight: 700; color: var(--ink)')}>No tasks yet</span>
              <p style={css('margin: 0; max-width: 360px; font-size: 13px; line-height: 1.5; color: var(--muted)')}>{ck.emptyText}</p>
              {(ck.templates || []).length ? (
                <div style={css('display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px')}>
                  {ck.templates.map((tp) => <button key={tp.label} type="button" onClick={tp.pick} style={css(QUICK_P + ' min-height: 36px;')}><I d="M12 5v14M5 12h14" size={12} />{tp.label}</button>)}
                </div>
              ) : null}
            </div>
          ) : null}
          <ul style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column')}>
            {(ck.items || []).map((x) => (
              <li key={x.id} style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid var(--line)')}>
                <button type="button" role="checkbox" aria-checked={x.done} aria-label={x.label} onClick={x.toggle} style={css('width: 20px; height: 20px; flex: none; padding: 0; box-sizing: border-box; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; ' + (x.done === 'true' ? 'border: 0; background: var(--inv); color: var(--inv-ink);' : 'border: 1.5px solid var(--border-strong); background: transparent; color: transparent;'))}>
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg>
                </button>
                <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px')}>
                  <span style={css(x.labelStyle)}>{x.label}</span>
                  {x.by ? <span style={css('font-size: 11.5px; color: var(--muted-2)')}>{x.by}</span> : null}
                </span>
                {x.canRemove ? <button type="button" className="fb-ni" aria-label={x.removeLabel} onClick={x.remove} style={css('width: 30px; height: 30px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><I d="M18 6 6 18M6 6l12 12" size={13} /></button> : null}
              </li>
            ))}
          </ul>
          {ck.canAdd ? (
            <div style={css('display: flex; gap: 8px; margin-top: 10px')}>
              <input id="dr-task-add" type="text" aria-label="New checklist step" placeholder="Add a task" value={ck.draft} onChange={ck.onDraft} onKeyDown={ck.onKey} style={css(V.fieldInput + ' min-height: 38px;')} />
              <button type="button" onClick={ck.add} style={css(QUICK + ' min-height: 38px;')}>Add</button>
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function Files({ V, CellPop }) {
  const dr = V.dr;
  return (
    <>
      {dr.deliver ? (
        <Section icon={ICON.link} title="Delivered work">
          <div style={css(CARD + ' padding: 4px 8px;')}>
            <DetailRow f={Object.assign({}, dr.deliver, { label: 'Link', emptyText: dr.deliver.can ? 'Add the link you hand to the client' : 'No link yet' })} V={V} CellPop={CellPop} />
          </div>
        </Section>
      ) : null}
      {/* app: Files. Search, type filter and grid / list views; images preview, documents show their type */}
      <Section icon="M21.4 11.1 12.2 20.3a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" title="Documents" action={dr.fileCount ? <span style={css('font-size: 11px; color: var(--muted)')}>{dr.fileCount}</span> : null}>
        <div style={css('display: flex; flex-direction: column; gap: 12px')}>
          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px')}>
            {dr.canUpload ? <button type="button" onClick={dr.upload} style={css(QUICK + ' min-height: 36px;')}><I d="M12 5v14M5 12h14" size={12} />Add file</button> : null}
            {dr.hasRoleUpload ? <button type="button" onClick={dr.roleUpload} style={css(QUICK_P + ' min-height: 36px;')}><I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={12} />{dr.roleUploadLabel}</button> : null}
            <label style={css('flex: 1 1 180px; min-width: 0; position: relative; display: flex; align-items: center')}>
              <span style={css(SR)}>Search files</span>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={css('position: absolute; right: 12px; color: var(--muted-2); pointer-events: none')}><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3"></path></svg>
              <input type="search" autoComplete="off" placeholder="Search for files" value={dr.fileQ} onChange={dr.onFileQ} style={css('width: 100%; min-height: 36px; box-sizing: border-box; padding: 0 34px 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-size: 13px; color: var(--ink)')} />
            </label>
            <div role="group" aria-label="File view" style={css('flex: none; display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--chip)')}>
              <button type="button" aria-label="Grid view" aria-pressed={dr.gridOn} title="Grid view" onClick={dr.setGrid} style={css(dr.gridBtn)}><I d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" size={15} /></button>
              <button type="button" aria-label="List view" aria-pressed={dr.listOn} title="List view" onClick={dr.setList} style={css(dr.listBtn)}><I d="M4 6h16M4 12h16M4 18h16" size={15} /></button>
            </div>
          </div>
          <div role="group" aria-label="File type" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 6px')}>
            {(dr.filters || []).map((f, f__i) => <button key={f__i} type="button" aria-pressed={f.on} onClick={f.pick} style={css(f.style + ' border-radius: 999px; min-height: 32px;')}>{f.label}</button>)}
          </div>
          {dr.hasFiles && dr.isGrid ? (
            <ul style={css('margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr)); gap: 12px')}>
              {(dr.assets || []).map((as) => (
                <li key={as.key} style={css('display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--line-3); border-radius: 14px; overflow: hidden; background: var(--surface)')}>
                  <a href="#" aria-label={as.aria} onClick={as.open} style={css('position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; background: var(--panel); color: var(--ink-3); text-decoration: none')}>
                    {as.hasPreview ? <img src={as.preview} alt="" loading="lazy" style={css('width: 100%; height: 100%; object-fit: cover; display: block')} /> : null}
                    {as.noPreview ? (
                      <span style={css('display: flex; flex-direction: column; align-items: center; gap: 10px')}>
                        <svg aria-hidden="true" width="40" height="48" viewBox="0 0 44 52" fill="none"><path d="M4 2h24l12 12v34a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--surface)" stroke="var(--line-4)" strokeWidth="2"></path><path d="M28 2v12h12" stroke="var(--line-4)" strokeWidth="2" strokeLinejoin="round"></path></svg>
                        <span style={css(as.badgeLg)}>{as.typeLabel}</span>
                      </span>
                    ) : null}
                    {as.hasVersion ? <span style={css('position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 6px; background: rgba(17,17,17,0.72); color: #FFFFFF; font-size: 11px; font-weight: 700')}>{as.version}</span> : null}
                  </a>
                  <div style={css('display: flex; flex-direction: column; gap: 3px; padding: 10px 12px 10px; min-width: 0')}>
                    <div style={css('display: flex; align-items: center; gap: 8px; min-width: 0')}>
                      <span style={css(as.badgeSm)}>{as.typeLabel}</span>
                      <span title={as.name} style={css('flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{as.name}</span>
                    </div>
                    <span style={css('font-size: 11.5px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{as.source}  ·  {as.meta}{as.size ? '  ·  ' + as.size : ''}</span>
                    <div style={css('display: flex; align-items: center; gap: 2px; margin-top: 4px')}>
                      <a href="#" aria-label={as.aria} onClick={as.open} style={css(V.dLink + '; min-height: 28px; padding: 0 6px; font-size: 12px')}>Open</a>
                      <button type="button" aria-label={'Download ' + as.name} onClick={as.download} style={css('min-height: 28px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-3); font-size: 12px; font-weight: 600; cursor: pointer')}>Download</button>
                      <span style={css('flex: 1')}></span>
                      {as.canDelete ? <button type="button" aria-label={as.delLabel + ' ' + as.name} onClick={as.del} style={css('min-height: 28px; padding: 0 6px; border: 0; border-radius: 8px; background: ' + (as.confirm ? 'var(--red-soft)' : 'transparent') + '; color: var(--red-ink); font-size: 12px; font-weight: 600; cursor: pointer')}>{as.delLabel}</button> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {dr.hasFiles && dr.isList ? (
            <div style={css('border: 1px solid var(--line-3); border-radius: 14px; background: var(--surface)')}>
              {(dr.assets || []).map((as) => (
                <div key={as.key} style={css(as.rowStyle)}>
                  <span aria-hidden="true" style={css('width: 40px; height: 40px; flex: none; border-radius: 10px; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: var(--panel)')}>
                    {as.hasPreview ? <img src={as.preview} alt="" loading="lazy" style={css('width: 100%; height: 100%; object-fit: cover; display: block')} /> : <span style={css(as.badgeSm)}>{as.typeLabel}</span>}
                  </span>
                  <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}>
                    <span title={as.name} style={css('font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{as.name}{as.hasVersion ? '  ·  ' + as.version : ''}</span>
                    <span style={css('font-size: 11.5px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{as.source}  ·  {as.meta}{as.size ? '  ·  ' + as.size : ''}</span>
                  </span>
                  <a href="#" aria-label={as.aria} onClick={as.open} style={css(V.dLink + '; font-size: 12px')}>Open</a>
                  <button type="button" aria-label={'Download ' + as.name} title="Download" onClick={as.download} className="fb-ni" style={css(V.dIconBtn + ' width: 34px; height: 34px;')}><I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" size={15} /></button>
                  {as.canDelete ? <button type="button" aria-label={as.delLabel + ' ' + as.name} onClick={as.del} style={css('flex: none; min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: ' + (as.confirm ? 'var(--red-soft)' : 'transparent') + '; color: var(--red-ink); font-size: 12px; font-weight: 600; cursor: pointer')}>{as.delLabel}</button> : null}
                </div>
              ))}
            </div>
          ) : null}
          {dr.noMatch ? <p style={css('margin: 0; padding: 16px 0; font-size: 13px; color: var(--muted)')}>No files match. Clear the search or pick All.</p> : null}
          {dr.assetsEmpty ? (
            <div style={css('display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 20px; border: 1.5px dashed var(--line-4); border-radius: 16px; text-align: center')}>
              <I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={26} />
              <p style={css('margin: 0; max-width: 360px; font-size: 13px; line-height: 1.5; color: var(--muted)')}>{dr.emptyFiles}</p>
            </div>
          ) : null}
        </div>
      </Section>
    </>
  );
}

function Activity({ V }) {
  const dr = V.dr;
  return (
    <Section icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" title="Activity">
      <div role="group" aria-label="Activity type" style={css('display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px')}>
        {(dr.histFilters || []).map((f) => <button key={f.label} type="button" aria-pressed={f.on} onClick={f.pick} style={css(f.style + ' min-height: 32px;')}>{f.label}</button>)}
      </div>
      {(dr.history || []).length ? (
        <ol style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column')}>
          {dr.history.map((h, h__i) => (
            <li key={h__i} style={css('display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line)')}>
              <span aria-hidden="true" style={css(h.avatarStyle)}>{h.initials}</span>
              <span style={css('flex: 1; min-width: 0; font-size: 13.5px; line-height: 1.45; color: var(--ink-3)')}>
                <span style={css('font-weight: 600; color: var(--ink)')}>{h.who}</span> <span>{h.text}</span>
                <span style={css('display: block; margin-top: 2px; font-size: var(--text-caption); color: var(--muted-2)')}>{h.time}</span>
              </span>
              <span aria-hidden="true" style={css(h.dotStyle)}></span>
            </li>
          ))}
        </ol>
      ) : (
        <div style={css('display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 20px; border: 1.5px dashed var(--line-4); border-radius: 16px; text-align: center')}>
          <I d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" size={26} />
          <span style={css('font-size: 14px; font-weight: 700; color: var(--ink)')}>Nothing matches this filter</span>
          <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>Try a different filter to see the rest of the history.</p>
        </div>
      )}
    </Section>
  );
}

// ---------- The modal ----------
export default function ProjectModal({ V, CellPop }) {
  const dr = V.dr;
  const IB = V.dIconBtn + ' width: 34px; height: 34px; border-radius: 10px;';
  return (
    <>
      <button type="button" aria-label="Close project details" onClick={V.closeDrawer} style={css('position: fixed; inset: 0; z-index: 44; border: 0; background: rgba(17,17,17,0.5); cursor: default')}></button>
      {/* app: files dropped anywhere on the panel upload to Files */}
      <dialog open aria-modal="true" aria-labelledby="drawer-title" className={'fb-dlg' + (dr.split ? ' fb-dlg-split' : '')} onKeyDown={dr.onKey} onDragOver={dr.onDragOver} onDragLeave={dr.onDragLeave} onDrop={dr.onDrop} style={css(dr.panelStyle)}>
        {dr.dragging ? (
          <div aria-hidden="true" style={css('position: absolute; inset: 10px; z-index: 5; display: flex; align-items: center; justify-content: center; border: 2px dashed var(--ink); border-radius: 20px; background: color-mix(in srgb, var(--surface) 88%, transparent); font-size: 16px; font-weight: 700; color: var(--ink); pointer-events: none')}>{dr.dropText}</div>
        ) : null}
        {/* Cover: the latest thumbnail in Files, collapsible from the header */}
        {dr.cover.show ? (
          <div className="fb-dlg-cover" style={css('position: relative; flex: none; width: 100%; overflow: hidden; transition: height .25s ease; height: ' + (dr.cover.open ? '150px' : '0'))}>
            <img src={dr.cover.url} alt="" loading="lazy" decoding="async" draggable={false} style={css('width: 100%; height: 100%; object-fit: cover; display: block')} />
            <div aria-hidden="true" style={css('position: absolute; inset: 0; background: linear-gradient(to top, color-mix(in srgb, var(--surface) 70%, transparent), transparent 55%)')}></div>
            <button type="button" onClick={dr.cover.view} style={css('position: absolute; right: 12px; bottom: 10px; min-height: 28px; padding: 0 10px; border: 1px solid var(--line-4); border-radius: 8px; background: color-mix(in srgb, var(--surface) 80%, transparent); color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; backdrop-filter: blur(6px)')}>Open thumbnail</button>
          </div>
        ) : null}
        {/* ─── Header ─── */}
        <header className="fb-dlg-hd" style={css('position: relative; z-index: 3; flex: none; display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 12px 22px; border-bottom: 1px solid var(--line)')}>
          <div style={css('display: flex; align-items: center; gap: 2px; min-width: 0')}>
            <span style={css(dr.jobStyle + ' height: 24px; border-radius: 6px; white-space: nowrap;')}>{dr.job}</span>
            <span style={css('display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; min-width: 0; font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>
              <span aria-hidden="true" style={css(dr.stageDot)}></span>{dr.breadcrumb || dr.stage}
            </span>
            <span style={css('flex: 1')}></span>
            <span className="fb-dlg-x" style={css('margin-right: 4px; font-size: 11.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; white-space: nowrap')}>{dr.posText}</span>
            <IconBtn label="Previous project" onClick={dr.prev} style={IB}><I d="M15 18l-6-6 6-6" size={17} /></IconBtn>
            <IconBtn label="Next project" onClick={dr.next} style={IB}><I d="M9 18l6-6-6-6" size={17} /></IconBtn>
            <span aria-hidden="true" className="fb-dlg-x" style={css('width: 1px; height: 18px; margin: 0 4px; background: var(--line-4)')}></span>
            {dr.cover.show ? <IconBtn label={dr.cover.label} hide onClick={dr.cover.toggle} style={IB}><I d={dr.cover.open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} size={16} /></IconBtn> : null}
            <IconBtn label="Copy link" hide onClick={dr.copyLink} style={IB}><I d={ICON.link} size={15} /></IconBtn>
            {dr.canWiden ? <IconBtn label={dr.wideLabel} hide pressed={dr.split ? 'true' : 'false'} onClick={dr.toggleWide} style={IB}><I d={dr.wideIcon} size={16} /></IconBtn> : null}
            {dr.more.items.length ? (
              <span style={css('position: relative; display: inline-flex')}>
                <button type="button" className="fb-ni" aria-label="More actions" title="More actions" aria-haspopup="menu" aria-expanded={dr.more.open ? 'true' : 'false'} onClick={dr.more.toggle} style={css(IB)}>
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.3" fill="currentColor"></circle><circle cx="8" cy="8" r="1.3" fill="currentColor"></circle><circle cx="12.5" cy="8" r="1.3" fill="currentColor"></circle></svg>
                </button>
                {dr.more.open ? (
                  <>
                    <button type="button" tabIndex="-1" aria-label="Close menu" onClick={dr.more.close} style={css('position: fixed; inset: 0; z-index: 20; border: 0; background: transparent; cursor: default')}></button>
                    <div role="menu" aria-label="More actions" style={css('position: absolute; z-index: 21; top: calc(100% + 6px); right: 0; width: 230px; padding: 6px; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.16)')}>
                      {dr.more.items.map((mi) => (
                        <button key={mi.label} type="button" role="menuitem" className="mitem" onClick={mi.pick} style={css('display: flex; align-items: center; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; color: ' + (mi.danger ? 'var(--red-ink)' : 'var(--ink)'))}>{mi.label}</button>
                      ))}
                    </div>
                  </>
                ) : null}
              </span>
            ) : null}
            <IconBtn label="Close" onClick={V.closeDrawer} style={IB}><I d="M18 6 6 18M6 6l12 12" size={17} /></IconBtn>
          </div>
          {/* app: click the title to rename the project in place (Super Admin) */}
          {dr.titleEdit && dr.titleEdit.editing ? (
            <input id="drawer-title" type="text" aria-label="Project name" autoFocus onFocus={(e) => e.target.select()} value={dr.titleEdit.text} onChange={dr.titleEdit.onText} onKeyDown={dr.titleEdit.onKey} onBlur={dr.titleEdit.save} maxLength={200}
              className="fb-dlg-ttl" style={css('margin: 0 0 0 -7px; font-family: var(--font-title); font-size: 24px; font-weight: var(--weight-black); line-height: 1.2; letter-spacing: -0.02em; color: var(--ink); width: calc(100% - 4px); box-sizing: border-box; padding: 2px 6px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface-2); outline: none')} />
          ) : dr.titleEdit && dr.titleEdit.can ? (
            <h2 id="drawer-title" style={css('margin: 0')}>
              <button type="button" className="ttl-edit fb-dlg-ttl" onClick={dr.titleEdit.start} aria-label={dr.titleEdit.aria} title="Click to rename"
                style={css('margin: 0 0 0 -7px; font-family: var(--font-title); font-size: 24px; font-weight: var(--weight-black); line-height: 1.2; letter-spacing: -0.02em; color: var(--ink); display: block; width: calc(100% - 4px); text-align: left; padding: 2px 6px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: text')}>{dr.title}</button>
            </h2>
          ) : (
            <h2 id="drawer-title" className="fb-dlg-ttl" style={css('margin: 0; font-family: var(--font-title); font-size: 24px; font-weight: var(--weight-black); line-height: 1.2; letter-spacing: -0.02em; color: var(--ink)')}>{dr.title}</h2>
          )}
          {/* State row: where it is, how far along, when it is due, who is on it */}
          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 2px')}>
            {dr.headStatus.show ? (
              <span style={css('position: relative; display: inline-flex')}>
                {dr.headStatus.can ? (
                  <button type="button" className="fb-stsel" aria-haspopup="dialog" aria-expanded={dr.headStatus.isOpen ? 'true' : 'false'} aria-label={'Status: ' + dr.headStatus.text + '. Change status'} onClick={dr.headStatus.open} style={css(dr.headStatus.style + ' border-radius: 999px; cursor: pointer;')}>
                    <span aria-hidden="true" style={css(dr.headStatus.dot)}></span>{dr.headStatus.text}
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  </button>
                ) : (
                  <span style={css(dr.headStatus.style + ' border-radius: 999px;')}><span aria-hidden="true" style={css(dr.headStatus.dot)}></span>{dr.headStatus.text}</span>
                )}
                {dr.headStatus.isOpen ? <CellPop ce={V.ce} popStyle={V.drPop} close={V.closeCell} dark={V.dark} /> : null}
              </span>
            ) : null}
            {dr.typeBlock ? <span style={css(dr.typeBlock.style + ' border-radius: 999px; height: 26px;')}>{dr.typeBlock.text}</span> : null}
            <span style={css('display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--ink-2)')} title={dr.progress.note}>
              <span role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={dr.progress.pct} style={css('display: block; width: 64px; height: 4px; border-radius: 999px; overflow: hidden; background: var(--chip-2)')}><span style={css(dr.progress.bar)}></span></span>
              <span style={css('font-variant-numeric: tabular-nums')}>{dr.progress.text}</span>
            </span>
            {dr.due.show ? <span style={css(dr.due.style)}>{dr.due.text}</span> : null}
            {dr.metaLine ? <span style={css('font-size: 11.5px; color: var(--muted)')}>{dr.metaLine}</span> : null}
            <span style={css('margin-left: auto; display: inline-flex; align-items: center; gap: 10px')}>
              {dr.people.length ? (
                <span style={css('display: inline-flex; align-items: center')}>
                  {dr.people.map((p, i) => <span key={p.name + i} title={p.title} aria-label={p.title} style={css(p.style + (i ? ' margin-left: -6px;' : ''))}>{p.initials}</span>)}
                </span>
              ) : null}
              {dr.updatedText ? <span style={css('font-size: 11.5px; color: var(--muted-2); white-space: nowrap')}>{dr.updatedText}</span> : null}
            </span>
          </div>
        </header>
        {/* ─── Tabs + quick actions ─── */}
        <div className="fb-dlg-tabs" style={css('flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 16px; border-bottom: 1px solid var(--line)')}>
          <div role="tablist" aria-label="Project sections" style={css('display: flex; align-items: center; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none')}>
            {(dr.tabs || []).map((t) => (
              <button key={t.key} type="button" role="tab" className={'fb-tab' + (t.isDetails ? ' fb-tab-details' : '')} id={t.id} aria-selected={t.selected} aria-controls="drawer-panel" onClick={t.pick} style={css(t.style)}>
                <span>{t.label}</span>
                {t.hasCount ? <span style={css(t.badge)}>{t.count}</span> : null}
                {t.bar ? <span aria-hidden="true" style={css(t.bar)}></span> : null}
              </button>
            ))}
          </div>
          <span style={css('flex: 1')}></span>
          <div className="fb-dlg-quick" style={css('flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 0')}>
            {(dr.quick || []).map((q) => (
              <button key={q.label} type="button" onClick={q.pick} style={css(q.primary ? QUICK_P : QUICK)}>
                {q.primary ? <I d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3" size={13} /> : null}{q.label}
              </button>
            ))}
          </div>
        </div>
        {/* ─── Body ─── */}
        <div className="fb-dlg-body" style={css(dr.bodyStyle)}>
          <div className="fb-dlg-main" style={css('display: flex; flex-direction: column; min-width: 0; min-height: 0')}>
            <div id="drawer-panel" role="tabpanel" aria-labelledby={dr.tabId} className="fb-dlg-pane" style={css('flex: 1 1 auto; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 18px 22px 28px; display: flex; flex-direction: column; gap: 22px')}>
              {dr.isOverview ? <Overview V={V} /> : null}
              {dr.isTasks ? <Tasks V={V} /> : null}
              {dr.isAssets ? <Files V={V} CellPop={CellPop} /> : null}
              {dr.isHistory ? <Activity V={V} /> : null}
              {dr.isDetails ? <Section title="Details"><DetailsRail V={V} CellPop={CellPop} /></Section> : null}
            </div>
          </div>
          {dr.split ? (
            <aside className="fb-dlg-rail" aria-label="Project details" style={css('min-height: 0; overflow-y: auto; box-sizing: border-box; border-left: 1px solid var(--line); background: var(--surface-2); padding: 16px 16px 24px; display: flex; flex-direction: column')}>
              <h3 style={css(SEC_T + ' margin: 0;')}>Details</h3>
              <DetailsRail V={V} CellPop={CellPop} />
            </aside>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
