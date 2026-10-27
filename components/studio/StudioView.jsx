'use client';
// Generated from the design canvas (YouTube Studio Unified Board, Main.dc.html) by a markup converter.
// Hand edits are marked with "app:" comments.
import { Fragment } from 'react';
import { css } from '@/lib/studio/css';
import DateField from './DateField';
import HeaderCell, { DeleteColumnDialog } from './HeaderCell';
import SelectPicker from './SelectPicker';
import StatusPicker from './StatusEditor';
import PropertySheet from './PropertySheet';
import CellEditor from './CellEditors';
import { FilterBy, SortEditor, FilterChips, NoMatch } from './FilterBar';
import { PropertiesPanel, GroupPanel, LayoutPanel } from './ViewPanels';
import { AddColumnStep2, QuickAdd } from './AddColumn';
import RecordDialog from './RecordDialog';
import { RichText, Thinking, Steps, MsgActions, ModelPicker, ModeToggle, GearButton, AiSettings, ChatScroll } from './ChatKit';

export default function StudioView({ V }) {
  return (
    <div style={css(V.rootStyle)} onClickCapture={(e) => { const a = e.target.closest && e.target.closest('a[href="#"]'); if (a) e.preventDefault(); }}>
      {/* app: Dev Notes floating dock for Super Admins (press N) */}
      {V.devNotes}
      {V.flowLayer}
      {/* app: record dialogs (templates, finance records, automations, two-step sign in) */}
      {V.rec ? <RecordDialog d={V.rec} /> : null}
      {/* app: toast for save confirmations and database errors */}
      {V.hasToast ? <div role="status" className="fb-toast" style={css("position: fixed; z-index: 80; left: 50%; bottom: 24px; transform: translateX(-50%); max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px 18px; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; box-shadow: 0 12px 40px rgba(0,0,0,0.2)" + (V.hasToastAction ? "; display: flex; align-items: center; gap: 14px; padding-right: 8px" : ""))}><span>{V.toast}</span>{V.hasToastAction ? <button type="button" onClick={V.toastAct} style={css("height: 32px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--inv-faint); color: var(--inv); font-size: 13px; font-weight: 700; cursor: pointer")}>{V.toastActionLabel}</button> : null}</div> : null}
      {/* app: delete confirm from the column header menu */}
      {V.colDel.open ? <DeleteColumnDialog d={V.colDel} dark={V.dark} /> : null}
      {/* app: Edit property side sheet (components/studio/PropertySheet.jsx) */}
      {V.sheet.open ? <PropertySheet key={V.sheet.key} p={V.sheet} dark={V.dark} /> : null}
      {/* app: What's New pop-up, shown once per Super Admin for the newest entry in lib/studio/releases.js */}
      {V.wn.open ? (
        <>
          <button type="button" aria-label="Close dialog" onClick={V.wn.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
          <dialog open aria-modal="true" aria-labelledby="wn-title" onKeyDown={V.wn.onKey} style={css(V.ui.dialog + " width: 560px; max-height: calc(100vh - 64px); overflow-y: auto")}>
            <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px")}>
              <div>
                <p style={css("margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--muted-2); letter-spacing: 0.02em")}>What’s new · {V.wn.date}</p>
                <h2 id="wn-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>{V.wn.title}</h2>
              </div>
              <button type="button" className="fb-ni" aria-label="Close" onClick={V.wn.close} style={css(V.ui.iconBtn)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <ul style={css("margin: 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 10px; font-size: var(--text-body-sm); line-height: 1.5; color: var(--ink-3)")}>
              {V.wn.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
            <div style={css("display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 24px")}>
              <button type="button" onClick={V.wn.viewAll} style={css(V.ui.btnGhost)}>See all updates</button>
              <button type="button" autoFocus onClick={V.wn.close} style={css(V.ui.btnPrimary)}>Got it</button>
            </div>
          </dialog>
        </>
      ) : null}
      {/* app: New project dialog, built from the design's dialog, field and dropdown styles */}
      {V.np.open ? (
        <>
          <button type="button" aria-label="Close dialog" onClick={V.np.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
          <dialog open aria-modal="true" aria-labelledby="np-title" onScroll={V.np.onScroll} style={css(V.ui.dialog + V.np.dialog)}>
            <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}><div><h2 id="np-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>New project</h2><p style={css("margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)")}>A template sets the content type, default team and due dates.</p></div><button type="button" className="fb-ni" aria-label="Close" onClick={V.np.close} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button></div>
            <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px")}><div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-name" style={css(V.fieldLabel)}>Title</label><input id="np-name" type="text" autoComplete="off" placeholder="What is the video?" value={V.np.title} onChange={V.np.onTitle} style={css(V.fieldInput)} /></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-job" style={css(V.fieldLabel)}>Job #</label><input id="np-job" type="text" autoComplete="off" placeholder="DTF-PU5" value={V.np.job} onChange={V.np.onJob} style={css(V.fieldInput)} /></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-template" style={css(V.fieldLabel)}>Template</label><div style={css(V.dd.npTemplate.wrap)} onKeyDown={V.dd.npTemplate.onKey}><button type="button" id="np-template" aria-haspopup="listbox" aria-expanded={V.dd.npTemplate.exp} aria-label={V.dd.npTemplate.aria} onClick={V.dd.npTemplate.toggle} style={css(V.dd.npTemplate.btn)}><span style={css(V.dd.npTemplate.valueStyle)}>{V.dd.npTemplate.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.npTemplate.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.npTemplate.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.npTemplate.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.npTemplate.label} style={css(V.dd.npTemplate.pop)}>{(V.dd.npTemplate.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-channel" style={css(V.fieldLabel)}>Channel</label><div style={css(V.dd.npChannel.wrap)} onKeyDown={V.dd.npChannel.onKey}><button type="button" id="np-channel" aria-haspopup="listbox" aria-expanded={V.dd.npChannel.exp} aria-label={V.dd.npChannel.aria} onClick={V.dd.npChannel.toggle} style={css(V.dd.npChannel.btn)}><span style={css(V.dd.npChannel.valueStyle)}>{V.dd.npChannel.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.npChannel.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.npChannel.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.npChannel.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.npChannel.label} style={css(V.dd.npChannel.pop)}>{(V.dd.npChannel.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}{/* app: quick add a channel from the New project dialog */}{V.dd.npChannel.empty ? <p style={css("margin: 0; padding: 8px 10px 4px; font-size: 13px; color: var(--muted)")}>No channels yet.</p> : null}{V.np.ch.canAdd ? (<div role="group" aria-label="Add channel" style={css("display: flex; flex-direction: column; gap: 6px; margin-top: 4px; padding: 8px 4px 2px; border-top: " + (V.dd.npChannel.empty ? "0" : "1px solid var(--line-4)"))}><div style={css("display: flex; gap: 6px")}><input type="text" autoComplete="off" aria-label="New channel name" placeholder="New channel name" value={V.np.ch.name} onChange={V.np.ch.onName} onKeyDown={V.np.ch.onKey} style={css("flex: 1; min-width: 0; min-height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 13px; color: var(--ink)")} /><button type="button" onClick={V.np.ch.add} disabled={V.np.ch.busy || !V.np.ch.name.trim()} style={css("flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 600; cursor: pointer; opacity: " + (V.np.ch.busy || !V.np.ch.name.trim() ? "0.5" : "1"))}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>{V.np.ch.busy ? "Adding" : "Add channel"}</button></div>{V.np.ch.err ? <p role="alert" style={css("margin: 0; font-size: 12px; font-weight: 600; color: var(--red-ink)")}>{V.np.ch.err}</p> : null}</div>) : V.dd.npChannel.empty ? <p style={css("margin: 0; padding: 0 10px 8px; font-size: 13px; color: var(--muted)")}>Ask a Super Admin to add one.</p> : null}</div></>) : null}</div></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-type" style={css(V.fieldLabel)}>Content type</label><div style={css(V.dd.npType.wrap)} onKeyDown={V.dd.npType.onKey}><button type="button" id="np-type" aria-haspopup="listbox" aria-expanded={V.dd.npType.exp} aria-label={V.dd.npType.aria} onClick={V.dd.npType.toggle} style={css(V.dd.npType.btn)}><span style={css(V.dd.npType.valueStyle)}>{V.dd.npType.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.npType.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.npType.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.npType.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.npType.label} style={css(V.dd.npType.pop)}>{(V.dd.npType.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-status" style={css(V.fieldLabel)}>Status</label><div style={css(V.dd.npStatus.wrap)} onKeyDown={V.dd.npStatus.onKey}><button type="button" id="np-status" aria-haspopup="listbox" aria-expanded={V.dd.npStatus.exp} aria-label={V.dd.npStatus.aria} onClick={V.dd.npStatus.toggle} style={css(V.dd.npStatus.btn)}><span style={css(V.dd.npStatus.valueStyle)}>{V.dd.npStatus.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.npStatus.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.npStatus.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.npStatus.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.npStatus.label} style={css(V.dd.npStatus.pop)}>{(V.dd.npStatus.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-sponsor" style={css(V.fieldLabel)}>Sponsor</label><div style={css(V.dd.npSponsor.wrap)} onKeyDown={V.dd.npSponsor.onKey}><button type="button" id="np-sponsor" aria-haspopup="listbox" aria-expanded={V.dd.npSponsor.exp} aria-label={V.dd.npSponsor.aria} onClick={V.dd.npSponsor.toggle} style={css(V.dd.npSponsor.btn)}><span style={css(V.dd.npSponsor.valueStyle)}>{V.dd.npSponsor.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.npSponsor.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.npSponsor.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.npSponsor.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.npSponsor.label} style={css(V.dd.npSponsor.pop)}>{(V.dd.npSponsor.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-film" style={css(V.fieldLabel)}>Film date</label><DateField weekStart={V.weekStart} id="np-film" value={V.np.film} onChange={V.np.onFilm} /></div><div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="np-pub" style={css(V.fieldLabel)}>Publishing date</label><DateField weekStart={V.weekStart} id="np-pub" value={V.np.pub} onChange={V.np.onPub} /></div></div>
            {V.np.hasErr ? <p role="alert" style={css("margin: 16px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.np.err}</p> : null}
            <div style={css("display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px")}><button type="button" className="fb-ni" onClick={V.np.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button><button type="button" onClick={V.np.create} disabled={!!V.np.busy} style={css(V.ui.btnPrimary)}>{V.np.createLabel}</button></div>
          </dialog>
        </>
      ) : null}
      {" "}
      <div style={css("flex: 1 0 auto; display: flex; align-items: stretch; margin: 16px; background: var(--surface); border: 1px solid var(--card-border); border-radius: 28px; box-shadow: var(--card-shadow)")}>
        <aside className="fb-side" aria-label="App navigation" style={css(V.sideStyle)}>
          <div style={css("position: sticky; top: 0; z-index: 35; height: calc(100vh - 32px); min-height: 560px; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto")}>
            <div style={css(V.sideHead)}>
              <span aria-hidden="true" style={css(V.tileStyle)}>
                {/* app: FTGU logo */}<img src="/ftgu-logo.png" alt="" width={24} height={18} style={css("display: block; width: 24px; height: auto")} />
              </span>
              {" "}
              {V.panelOpen ? (
                <>
                  <div style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                    <p style={css("margin: 0; font-family: var(--font-title); font-size: 15px; font-weight: var(--weight-black); line-height: 1.25; letter-spacing: -0.01em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{V.wsName}</p>
                    {" "}
                    <p style={css("margin: 0; font-size: 13px; line-height: 1.3; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{V.wsSub}</p>
                  </div>
                </>
              ) : null}
              {" "}
              <button type="button" className="fb-ni" aria-label={V.panelToggleLabel} aria-pressed={V.panelPressed} onClick={V.togglePanel} style={css(V.collapseBtn)}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 3v18"></path>
                  <path d={V.collapseChev}></path>
                </svg>
              </button>
            </div>
            {" "}
            <div style={css("height: 1px; margin: 0 16px; background: var(--line); flex: none")}></div>
            {/* app: account switcher for sponsor and client logins linked to several accounts */}
            {V.hasAcctSwitch && V.panelOpen ? (
              <div style={css("display: flex; flex-direction: column; gap: 6px; padding: 16px 12px 0")}>
                <label htmlFor="acct-switch" style={css("margin: 0; padding: 0 4px; font-size: 13px; font-weight: 600; color: var(--muted-2)")}>Account</label>
                <div style={css(V.dd.acct.wrap)} onKeyDown={V.dd.acct.onKey}><button type="button" id="acct-switch" aria-haspopup="listbox" aria-expanded={V.dd.acct.exp} aria-label={V.dd.acct.aria} onClick={V.dd.acct.toggle} style={css(V.dd.acct.btn)}><span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.acct.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.acct.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.acct.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.acct.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.acct.label} style={css(V.dd.acct.pop)}>{(V.dd.acct.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div>
              </div>
            ) : null}
            {" "}
            <nav aria-label="Main" style={css("display: flex; flex-direction: column; gap: 4px; padding: 16px 12px")}>
              {(V.navItems || []).map((n, n__i) => (
                <Fragment key={n__i}>
                  <button type="button" className={n.cls} aria-label={n.aria} aria-current={n.current} onClick={n.pick} style={css(n.style)}>
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none")}>
                      <path d={n.icon}></path>
                      <path d={n.dots} strokeWidth="2.4"></path>
                    </svg>
                    {" "}
                    <span style={css(V.navLabel)}>{n.label}</span>
                    {" "}
                    <span aria-hidden="true" style={css(n.badgeStyle)}>{n.count}</span>
                  </button>
                </Fragment>
              ))}
            </nav>
            {" "}
            {V.hasAdminNav ? (
              <>
                {V.panelOpen ? (
                  <>
                    <button type="button" className="fb-ni" aria-expanded={V.adminExp} onClick={V.toggleAdmin} style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px; width: calc(100% - 24px); min-height: 44px; margin: 4px 12px 0; padding: 0 12px; box-sizing: border-box; border: 0; border-radius: 12px; background: transparent; font-size: 13px; font-weight: 600; color: var(--muted-2); cursor: pointer")}>
                      <span>Admin</span>
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" style={css(V.adminChev)}>
                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  </>
                ) : null}
                {" "}
                {V.panelClosed ? (
                  <>
                    <div style={css("height: 1px; margin: 8px 16px; background: var(--line); flex: none")}></div>
                  </>
                ) : null}
                {" "}
                {V.adminShown ? (
                  <>
                    <nav aria-label="Admin" style={css("display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px")}>
                      {(V.adminNav || []).map((n, n__i) => (
                        <Fragment key={n__i}>
                          <button type="button" className={n.cls} aria-label={n.aria} aria-current={n.current} onClick={n.pick} style={css(n.style)}>
                            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none")}>
                              <path d={n.icon}></path>
                            </svg>
                            {" "}
                            <span style={css(V.navLabel)}>{n.label}</span>
                            {" "}
                            <span aria-hidden="true" style={css(n.badgeStyle)}>{n.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </nav>
                  </>
                ) : null}
              </>
            ) : null}
            {" "}
            <div style={css("margin-top: auto; padding: 12px; border-top: 1px solid var(--line)")}>
              <button type="button" className="fb-ni" aria-label="Account settings" aria-current={V.acctCurrent} onClick={V.openSettings} style={css(V.acctStyle)}>
                <span aria-hidden="true" style={css("width: 28px; height: 28px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--chip-2); color: var(--ink-2)")}>{V.acctInitial}</span>
                {" "}
                <span style={css(V.navLabel)}>Account</span>
              </button>
            </div>
          </div>
        </aside>
        {" "}
        {/* app: <main> landmark around each page (QA a11y: landmark-one-main, region) */}
        <main style={css("flex: 1 1 0; min-width: 0; box-sizing: border-box")}>
          <nav className="fb-mobile" aria-label="Main compact" style={css("display: none; gap: 4px; padding: 5px; margin: 16px 16px 0; background: var(--track); border-radius: 16px; overflow-x: auto")}>
            {(V.navItems || []).map((n, n__i) => (
              <Fragment key={n__i}>
                <button type="button" aria-label={n.label} aria-current={n.current} onClick={n.pick} style={css(n.mstyle)}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d={n.icon}></path>
                    <path d={n.dots} strokeWidth="2.6"></path>
                  </svg>
                </button>
              </Fragment>
            ))}
            {" "}
            {(V.adminNav || []).map((n, n__i) => (
              <Fragment key={n__i}>
                <button type="button" aria-label={n.label} aria-current={n.current} onClick={n.pick} style={css(n.mstyle)}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d={n.icon}></path>
                  </svg>
                </button>
              </Fragment>
            ))}
          </nav>
          {" "}
          {V.showAdmin ? (
            <>
              <div className="fb-page" style={css("padding: 32px 40px 40px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px")}>
                <header style={css("display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px")}>
                  <div style={css("display: flex; flex-direction: column; gap: 8px; max-width: 640px")}>
                    <p style={css("margin: 0; display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-body-sm); color: var(--muted-2)")}>
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4"></path>
                      </svg>
                      {" Admin · Super Admin only "}
                    </p>
                    {" "}
                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 10px")}>
                      <h1 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h1); font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.03em; color: var(--ink)")}>{V.ap.title}</h1>
                      {" "}
                      {V.ap.hasTag ? (
                        <>
                          <span style={css(V.ap.tagStyle)}>{V.ap.tag}</span>
                        </>
                      ) : null}
                    </div>
                    {" "}
                    <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted)")}>{V.ap.desc}</p>
                  </div>
                  {" "}
                  <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                    {V.ap.hasNote ? (
                      <>
                        <span style={css(V.ap.noteStyle)}>{V.ap.note}</span>
                      </>
                    ) : null}
                    {" "}
                    {V.ap.hasGhost ? (
                      <>
                        <button type="button" onClick={V.ap.ghostPick} style={css(V.ui.btnGhost)}>{V.ap.ghost}</button>
                      </>
                    ) : null}
                    {" "}
                    {V.ap.hasPrimary ? (
                      <>
                        <button type="button" onClick={V.ap.primaryPick} style={css(V.ui.btnPrimary)}>
                          {V.ap.plus ? (
                            <>
                              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                                <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                              </svg>
                            </>
                          ) : null}
                          {" "}{V.ap.primary}{" "}
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>
                {" "}
                {V.adm.hasStats ? (
                  <>
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 12px")}>
                      {(V.adm.stats || []).map((st, st__i) => (
                        <Fragment key={st__i}>
                          <div style={css(V.ui.stat)}>
                            <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>{st.label}</span>
                            {" "}
                            <span style={css("font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums")}>{st.value}</span>
                            {" "}
                            <span style={css(st.subStyle)}>{st.sub}</span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
                {" "}
                {V.adm.isUsers ? (
                  <>
                    {/* app: invite email health (app/api/email/health) */}
                    {V.adm.mailWarn ? <p role="status" style={css("margin: 0 0 16px; padding: 12px 14px; border-radius: 12px; background: var(--amber-soft); color: var(--amber-ink); font-size: 13px; line-height: 1.45; font-weight: 600")}>{V.adm.mailWarn}</p> : null}
                    <div style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      <div style={css("position: relative; display: flex; align-items: center; flex: 1 1 200px; max-width: 280px; margin-right: 4px")}>
                        <label htmlFor="team-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search users</label>
                        {" "}
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                        </svg>
                        {" "}
                        <input id="team-search" type="search" placeholder="Search name or email" onChange={V.onTeamSearch} style={css(V.ui.search)} />
                      </div>
                      {" "}
                      {(V.teamTabs || []).map((tt, tt__i) => (
                        <Fragment key={tt__i}>
                          <button type="button" className="fb-ni" aria-pressed={tt.pressed} onClick={tt.pick} style={css(tt.style)}>
                            <span>{tt.label}</span>
                            {" "}
                            <span style={css(tt.badge)}>{tt.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    <div style={css("position: relative; overflow-x: auto; padding-bottom: 8px")}>
                      <div role="table" aria-label="Users" style={css("min-width: 1080px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                        <div role="row" style={css(V.teamHeadStyle)}>
                          <span role="columnheader" style={css(V.thStyle)}>Name</span>
                          {" "}
                          <span role="columnheader" style={css(V.thStyle)}>User type</span>
                          {" "}
                          <span role="columnheader" style={css(V.thStyle)}>Views</span>
                          {" "}
                          <span role="columnheader" style={css(V.thStyle)}>Status</span>
                          {" "}
                          <span role="columnheader" style={css(V.thStyle)}>Last active</span>
                          {" "}
                          <span role="columnheader" style={css(V.thStyle)}>
                            <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Actions</span>
                          </span>
                        </div>
                        {" "}
                        {(V.teamRows || []).map((m, m__i) => (
                          <Fragment key={m__i}>
                            <div role="row" className="row" style={css(V.teamRowStyle)}>
                              <div role="cell" style={css("display: flex; align-items: center; gap: 12px; min-width: 0; padding: 0 16px")}>
                                <span aria-hidden="true" style={css(m.avatarStyle)}>{m.initials}</span>
                                {" "}
                                <span style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}>
                                  <span style={css(m.nameStyle)}>{m.displayName}</span>
                                  {" "}
                                  <span style={css("font-size: 13px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{m.email}</span>
                                </span>
                              </div>
                              {" "}
                              <div role="cell" style={css("padding: 0 16px")}>
                                <span style={css(m.typeStyle)}>{m.typeLabel}</span>
                              </div>
                              {" "}
                              <div role="cell" style={css("display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px")}>
                                {(m.views || []).map((vw, vw__i) => (
                                  <Fragment key={vw__i}>
                                    <span style={css(V.viewChip)}>{vw.label}</span>
                                  </Fragment>
                                ))}
                              </div>
                              {" "}
                              <div role="cell" style={css("padding: 0 16px")}>
                                <span style={css(m.statusStyle)}>{m.status}</span>
                              </div>
                              {" "}
                              <div role="cell" style={css("padding: 0 16px; font-size: 13px; color: var(--ink-3); white-space: nowrap")}>{m.lastActive}</div>
                              {" "}
                              <div role="cell" style={css("display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px; padding: 8px 12px")}>
                                {(m.actions || []).map((ma, ma__i) => (
                                  <Fragment key={ma__i}>
                                    <button type="button" className="fb-ni" aria-label={ma.aria} onClick={ma.pick} style={css(ma.style)}>{ma.label}</button>
                                  </Fragment>
                                ))}
                                {" "}
                                {m.isOwner ? (
                                  <>
                                    <span style={css("padding: 0 12px; font-size: 13px; color: var(--muted-2)")}>Workspace owner</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </Fragment>
                        ))}
                        {" "}
                        {V.teamEmpty ? (
                          <>
                            <p style={css("margin: 0; padding: 24px 16px; border-top: 1px solid var(--line); font-size: var(--text-body-sm); color: var(--muted)")}>No one matches this search.</p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.teamModal ? (
                  <>
                    <button type="button" aria-label="Close dialog" onClick={V.closeAddUser} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                    {" "}
                    <dialog open aria-modal="true" aria-labelledby="add-user-title" style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 520px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.20); padding: 24px; color: var(--ink); font-family: var(--font-main)")}>
                      <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}>
                        <div>
                          <h2 id="add-user-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Add user</h2>
                          {" "}
                          <p style={css("margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)")}>They get an invite email and see only the views you pick.</p>
                        </div>
                        {" "}
                        <button type="button" className="fb-ni" aria-label="Close" onClick={V.closeAddUser} style={css("width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                      {" "}
                      <div style={css("display: flex; flex-direction: column; gap: 18px")}>
                        <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                          <label htmlFor="nu-name" style={css(V.fieldLabel)}>Full name</label>
                          {" "}
                          <input id="nu-name" type="text" autoComplete="off" placeholder="Jordan Lee" onChange={V.onNuName} style={css(V.fieldInput)} />
                        </div>
                        {" "}
                        <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                          <label htmlFor="nu-email" style={css(V.fieldLabel)}>Email</label>
                          {" "}
                          <input id="nu-email" type="email" autoComplete="off" placeholder="name@company.com" onChange={V.onNuEmail} style={css(V.fieldInput)} />
                        </div>
                        {" "}
                        <div role="radiogroup" aria-labelledby="nu-type-label" style={css("display: flex; flex-direction: column; gap: 8px")}>
                          <p id="nu-type-label" style={css(V.fieldLabel)}>User type</p>
                          {" "}
                          <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr)); gap: 8px")}>
                            {(V.nuTypes || []).map((ty, ty__i) => (
                              <Fragment key={ty__i}>
                                <label className="fb-radio" style={css(ty.style)}>
                                  <input type="radio" name="nu-type" checked={!!ty.on} onChange={ty.pick} style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; opacity: 0")} />
                                  {" "}
                                  <span aria-hidden="true" style={css(ty.tileStyle)}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d={ty.icon}></path>
                                    </svg>
                                  </span>
                                  {" "}
                                  <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px")}>
                                    <span style={css("font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--ink)")}>{ty.label}</span>
                                    {" "}
                                    <span style={css("font-size: 12px; line-height: 1.4; color: var(--muted)")}>{ty.blurb}</span>
                                  </span>
                                  {" "}
                                  <span aria-hidden="true" style={css(ty.radioStyle)}></span>
                                </label>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                        {" "}
                        {/* app: which client or sponsor account this login belongs to */}
                        {V.nuIsExternal ? (
                          <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="nu-acct" style={css(V.fieldLabel)}>Account</label><div style={css(V.dd.nuAcct.wrap)} onKeyDown={V.dd.nuAcct.onKey}><button type="button" id="nu-acct" aria-haspopup="listbox" aria-expanded={V.dd.nuAcct.exp} aria-label={V.dd.nuAcct.aria} onClick={V.dd.nuAcct.toggle} style={css(V.dd.nuAcct.btn)}><span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.nuAcct.value}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.nuAcct.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>{V.dd.nuAcct.open ? (<><button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.nuAcct.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button><div role="listbox" aria-label={V.dd.nuAcct.label} style={css(V.dd.nuAcct.pop)}>{(V.dd.nuAcct.items || []).map((o, i) => (<button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}><span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span><span style={css("flex: 1")}>{o.label}</span></button>))}</div></>) : null}</div></div>
                        ) : null}
                        <div role="group" aria-labelledby="nu-views-label" style={css("display: flex; flex-direction: column; gap: 8px")}>
                          <p id="nu-views-label" style={css(V.fieldLabel)}>Views</p>
                          {" "}
                          <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                            {(V.nuViewItems || []).map((nv, nv__i) => (
                              <Fragment key={nv__i}>
                                <label style={css(nv.style)}>
                                  <input type="checkbox" checked={!!nv.on} onChange={nv.pick} style={css("width: 16px; height: 16px; margin: 0; accent-color: var(--ink)")} />
                                  {" "}
                                  <span>{nv.label}</span>
                                </label>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                        {" "}
                        {V.hasNuErr ? (
                          <>
                            <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.nuErr}</p>
                          </>
                        ) : null}
                      </div>
                      {" "}
                      <div style={css("display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px")}>
                        <button type="button" className="fb-ni" onClick={V.closeAddUser} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                        {" "}
                        <button type="button" onClick={V.addMember} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer")}>Send invite</button>
                      </div>
                    </dialog>
                  </>
                ) : null}
                {" "}
                {V.adm.isRoles ? (
                  <>
                    <div role="group" aria-label="User type" style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      {(V.adm.roleTabs || []).map((rt, rt__i) => (
                        <Fragment key={rt__i}>
                          <button type="button" className="fb-ni" aria-pressed={rt.pressed} onClick={rt.pick} style={css(rt.style)}>
                            <span>{rt.label}</span>
                            {" "}
                            <span style={css(rt.badge)}>{rt.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                      <span style={css(V.adm.roleBlock)}>{V.adm.roleLabel}</span>
                      {" "}
                      <span style={css("flex: 1 1 280px; font-size: var(--text-body-sm); color: var(--ink-3)")}>{V.adm.roleDesc}</span>
                      {" "}
                      <span style={css("font-size: 13px; font-weight: 600; color: var(--muted-2)")}>{V.adm.roleMembers}</span>
                    </div>
                    {" "}
                    <section aria-labelledby="perm-h" style={css("display: flex; flex-direction: column; gap: 12px")}>
                      <div style={css("display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px")}>
                        <h2 id="perm-h" style={css(V.ui.h2)}>Permissions</h2>
                        {" "}
                        <span style={css("font-size: 13px; color: var(--muted)")}>{V.adm.permNote}</span>
                      </div>
                      {" "}
                      <div style={css("position: relative; overflow-x: auto; padding-bottom: 8px")}>
                        <div role="table" aria-label="Permissions" style={css("min-width: 760px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                          <div role="row" style={css(V.adm.permHeadStyle)}>
                            <span role="columnheader" style={css(V.thStyle)}>Area</span>
                            {" "}
                            {(V.adm.permHead || []).map((ph, ph__i) => (
                              <Fragment key={ph__i}>
                                <span role="columnheader" style={css(ph.style)}>{ph.label}</span>
                              </Fragment>
                            ))}
                          </div>
                          {" "}
                          {(V.adm.permRows || []).map((pr, pr__i) => (
                            <Fragment key={pr__i}>
                              <div role="row" className="row" style={css(V.adm.permRowStyle)}>
                                <div role="cell" style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 12px 16px")}>
                                  <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{pr.label}</span>
                                  {" "}
                                  <span style={css("font-size: 12px; color: var(--muted-2)")}>{pr.desc}</span>
                                </div>
                                {" "}
                                {(pr.cells || []).map((pc, pc__i) => (
                                  <Fragment key={pc__i}>
                                    <div role="cell" style={css("display: flex; align-items: center; justify-content: center")}>
                                      {pc.isBox ? (
                                        <>
                                          <label style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                                            <input type="checkbox" checked={!!pc.on} onChange={pc.pick} style={css("width: 18px; height: 18px; margin: 0; accent-color: var(--ink); cursor: pointer")} />
                                            {" "}
                                            <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{pc.aria}</span>
                                          </label>
                                        </>
                                      ) : null}
                                      {" "}
                                      {pc.isLocked ? (
                                        <>
                                          <span style={css("display: inline-flex; color: var(--ink)")}>
                                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M3.5 8.5l3 3 6-7"></path>
                                            </svg>
                                            {" "}
                                            <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{pc.aria}</span>
                                          </span>
                                        </>
                                      ) : null}
                                      {" "}
                                      {pc.isNa ? (
                                        <>
                                          <span style={css("font-size: 12px; color: var(--muted-2)")}>n/a</span>
                                        </>
                                      ) : null}
                                    </div>
                                  </Fragment>
                                ))}
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </section>
                    {" "}
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 16px")}>
                      <section aria-labelledby="rv-h" style={css(V.ui.panel)}>
                        <h2 id="rv-h" style={css(V.ui.h3)}>Board views</h2>
                        {" "}
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>Default views for new users of this type.</p>
                        {" "}
                        <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                          {(V.adm.roleViews || []).map((rv, rv__i) => (
                            <Fragment key={rv__i}>
                              {rv.isBox ? (
                                <>
                                  <label style={css(rv.style)}>
                                    <input type="checkbox" checked={!!rv.on} onChange={rv.pick} style={css("width: 16px; height: 16px; margin: 0; accent-color: var(--ink)")} />
                                    <span>{rv.label}</span>
                                  </label>
                                </>
                              ) : null}
                              {" "}
                              {rv.isLocked ? (
                                <>
                                  <span style={css(V.viewChip)}>{rv.label}</span>
                                </>
                              ) : null}
                            </Fragment>
                          ))}
                        </div>
                      </section>
                      {" "}
                      <section aria-labelledby="rf-h" style={css(V.ui.panel)}>
                        <h2 id="rf-h" style={css(V.ui.h3)}>Visible fields</h2>
                        {" "}
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.roleFieldNote}</p>
                        {" "}
                        <div style={css("display: flex; flex-wrap: wrap; gap: 6px")}>
                          {(V.adm.roleFields || []).map((rf, rf__i) => (
                            <Fragment key={rf__i}>
                              <span style={css(V.viewChip)}>{rf.label}</span>
                            </Fragment>
                          ))}
                        </div>
                      </section>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.adm.isPM ? (
                  <>
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; align-items: start")}>
                      <section aria-labelledby="na-h" style={css(V.ui.panel)}>
                        <div style={css("display: flex; align-items: center; gap: 10px")}>
                          <h2 id="na-h" style={css(V.ui.h3)}>Needs attention</h2>
                          {" "}
                          <span style={css(V.ui.countPill)}>{V.adm.attnCount}</span>
                        </div>
                        {" "}
                        <div style={css("display: flex; flex-direction: column; margin: 0 -20px -20px; border-top: 1px solid var(--line)")}>
                          {(V.adm.attention || []).map((na, na__i) => (
                            <Fragment key={na__i}>
                              <div className="row" style={css("display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px 6px 20px; border-bottom: 1px solid var(--line); box-sizing: border-box")}>
                                <span style={css(na.reasonStyle)}>{na.reason}</span>
                                {" "}
                                <span style={css("flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{na.title}</span>
                                {" "}
                                <span style={css(na.dueStyle)}>{na.due}</span>
                                {" "}
                                <button type="button" className="fb-ni" aria-label={na.aria} onClick={na.open} style={css(V.ui.ghostSm)}>Open</button>
                              </div>
                            </Fragment>
                          ))}
                          {" "}
                          {V.adm.attnEmpty ? (
                            <>
                              <p style={css("margin: 0; padding: 20px; font-size: var(--text-body-sm); color: var(--muted)")}>Nothing is late or unassigned.</p>
                            </>
                          ) : null}
                        </div>
                      </section>
                      {" "}
                      <section aria-labelledby="wl-h" style={css(V.ui.panel)}>
                        <h2 id="wl-h" style={css(V.ui.h3)}>Team workload</h2>
                        {" "}
                        <div role="table" aria-label="Team workload" style={css("position: relative; display: flex; flex-direction: column; margin: 0 -20px -20px; border-top: 1px solid var(--line); overflow-x: auto")}>
                          <div role="row" style={css(`${V.adm.wlGrid ?? ''} min-height: 40px; border-bottom: 1px solid var(--line)`)}>
                            <span role="columnheader" style={css(V.thStyle)}>Person</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Active</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Late</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Next due</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Load</span>
                          </div>
                          {" "}
                          {(V.adm.workload || []).map((wl, wl__i) => (
                            <Fragment key={wl__i}>
                              <div role="row" className="row" style={css(V.adm.wlRow)}>
                                <div role="cell" style={css("display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 16px")}>
                                  <span aria-hidden="true" style={css(wl.avatarStyle)}>{wl.initials}</span>
                                  {" "}
                                  <span style={css("display: flex; flex-direction: column; min-width: 0")}>
                                    <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{wl.name}</span>
                                    <span style={css("font-size: 12px; color: var(--muted-2)")}>{wl.role}</span>
                                  </span>
                                </div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums")}>{wl.active}</div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px")}>
                                  <span style={css(wl.lateStyle)}>{wl.late}</span>
                                </div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px; font-size: 13px; color: var(--ink-3); white-space: nowrap")}>{wl.next}</div>
                                {" "}
                                <div role="cell" style={css("display: flex; align-items: center; gap: 8px; padding: 0 16px")}>
                                  <span aria-hidden="true" style={css("flex: 1; height: 8px; background: var(--chip-2)")}>
                                    <span style={css(wl.barStyle)}></span>
                                  </span>
                                  {" "}
                                  <span style={css("font-size: 12px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums")}>{wl.loadText}</span>
                                </div>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </section>
                    </div>
                    {" "}
                    <section aria-labelledby="wf-h" style={css(V.ui.panel)}>
                      <h2 id="wf-h" style={css(V.ui.h3)}>Workflow</h2>
                      {" "}
                      <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>Every project moves through these statuses in order. Edit names and colors in Workspace Settings.</p>
                      {" "}
                      <ol style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 6px")}>
                        {(V.adm.flow || []).map((fl, fl__i) => (
                          <Fragment key={fl__i}>
                            <li style={css("display: inline-flex; align-items: center; gap: 6px")}>
                              <span style={css("display: inline-flex; flex-direction: column; gap: 4px")}>
                                <span style={css(fl.style)}>{fl.label}</span>
                                {" "}
                                <span style={css("font-size: 11px; font-weight: 600; color: var(--muted-2)")}>{fl.stage}</span>
                              </span>
                              {" "}
                              {fl.hasArrow ? (
                                <>
                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={css("margin-bottom: 18px")}>
                                    <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"></path>
                                  </svg>
                                </>
                              ) : null}
                            </li>
                          </Fragment>
                        ))}
                      </ol>
                      {" "}
                      <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 20px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                        <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                          <p style={css("margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2)")}>Deadline defaults</p>
                          {" "}
                          {(V.adm.deadlines || []).map((dl, dl__i) => (
                            <Fragment key={dl__i}>
                              <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                                <label htmlFor={dl.id} style={css("font-size: 14px; color: var(--ink-3)")}>{dl.label}</label>
                                {" "}
                                <span style={css("display: inline-flex; align-items: center; gap: 8px")}>
                                  <input id={dl.id} type="number" min="0" max="60" value={dl.value ?? ''} onChange={dl.onChange} style={css("width: 72px; min-height: 44px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink); text-align: center; font-variant-numeric: tabular-nums")} />
                                  {" "}
                                  <span style={css("font-size: 13px; color: var(--muted)")}>days</span>
                                </span>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                          <p style={css("margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--ink-2)")}>Rules</p>
                          {" "}
                          {(V.adm.rules || []).map((ru, ru__i) => (
                            <Fragment key={ru__i}>
                              <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                                <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                  <span style={css("font-size: 14px; color: var(--ink)")}>{ru.label}</span>
                                  <span style={css("font-size: 12px; color: var(--muted-2)")}>{ru.desc}</span>
                                </span>
                                {" "}
                                <button type="button" role="switch" aria-checked={ru.on} aria-label={ru.label} onClick={ru.toggle} style={css(V.ui.swBtn)}>
                                  <span aria-hidden="true" style={css(ru.track)}>
                                    <span style={css(ru.knob)}></span>
                                  </span>
                                </button>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}
                {" "}
                {V.adm.isClients ? (
                  <>
                    {/* app: invite email health (app/api/email/health) */}
                    {V.adm.mailWarn ? <p role="status" style={css("margin: 0 0 16px; padding: 12px 14px; border-radius: 12px; background: var(--amber-soft); color: var(--amber-ink); font-size: 13px; line-height: 1.45; font-weight: 600")}>{V.adm.mailWarn}</p> : null}
                    <div style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      <div style={css("position: relative; display: flex; align-items: center; flex: 1 1 200px; max-width: 280px; margin-right: 4px")}>
                        <label htmlFor="acct-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search accounts</label>
                        {" "}
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                        </svg>
                        {" "}
                        <input id="acct-search" type="search" placeholder="Search accounts" onChange={V.adm.onAcctSearch} style={css(V.ui.search)} />
                      </div>
                      {" "}
                      {(V.adm.acctTabs || []).map((at, at__i) => (
                        <Fragment key={at__i}>
                          <button type="button" className="fb-ni" aria-pressed={at.pressed} onClick={at.pick} style={css(at.style)}>
                            <span>{at.label}</span>
                            {" "}
                            <span style={css(at.badge)}>{at.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    <div style={css("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start")}>
                      <div style={css("position: relative; flex: 1 1 560px; min-width: 0; overflow-x: auto; padding-bottom: 8px")}>
                        <div role="table" aria-label="Accounts" style={css("min-width: 620px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                          <div role="row" style={css(`${V.adm.acctGrid ?? ''} min-height: 44px`)}>
                            <span role="columnheader" style={css(V.thStyle)}>Account</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Type</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Projects</span>
                            {" "}
                            <span role="columnheader" style={css(V.thStyle)}>Portal</span>
                          </div>
                          {" "}
                          {(V.adm.accounts || []).map((ac, ac__i) => (
                            <Fragment key={ac__i}>
                              <div role="row" className={ac.cls} style={css(V.adm.acctRow)}>
                                <div role="cell" style={css("display: flex; align-items: center; gap: 12px; min-width: 0; padding: 0 16px")}>
                                  <span aria-hidden="true" style={css(ac.tileStyle)}>{ac.initials}</span>
                                  {" "}
                                  <button type="button" className="fb-title" aria-pressed={ac.pressed} onClick={ac.pick} style={css(V.ui.cellBtn)}>
                                    <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{ac.name}</span>
                                    {" "}
                                    <span style={css("font-size: 12px; font-weight: 400; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none")}>{ac.contact}</span>
                                  </button>
                                </div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px")}>
                                  <span style={css(ac.typeStyle)}>{ac.typeLabel}</span>
                                </div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--ink-2)")}>{ac.projectsText}</div>
                                {" "}
                                <div role="cell" style={css("padding: 0 16px")}>
                                  <span style={css(ac.portalStyle)}>{ac.portal}</span>
                                </div>
                              </div>
                            </Fragment>
                          ))}
                          {" "}
                          {V.adm.acctEmpty ? (
                            <>
                              <p style={css("margin: 0; padding: 24px 16px; border-top: 1px solid var(--line); font-size: var(--text-body-sm); color: var(--muted)")}>No accounts match.</p>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {" "}
                      {V.adm.hasAcct ? (
                        <>
                          <aside aria-labelledby="acct-detail-h" style={css("flex: 1 1 340px; max-width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                            <div style={css("display: flex; align-items: center; gap: 12px")}>
                              <span aria-hidden="true" style={css(V.adm.acct.tileStyle)}>{V.adm.acct.initials}</span>
                              {" "}
                              <div style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px")}>
                                <h2 id="acct-detail-h" style={css(V.ui.h3)}>{V.adm.acct.name}</h2>
                                {" "}
                                <span style={css("font-size: 13px; color: var(--muted-2); overflow-wrap: anywhere")}>{V.adm.acct.contactText}</span>
                              </div>
                              {" "}
                              <span style={css(V.adm.acct.typeStyle)}>{V.adm.acct.typeLabel}</span>
                              {" "}
                              {/* app: edit the account's name, contact email and type */}
                              {!V.adm.acct.edit.on ? <button type="button" className="fb-ni" onClick={V.adm.acct.edit.start} style={css(V.ui.ghostSm)}>Edit</button> : null}
                            </div>
                            {" "}
                            {V.adm.acct.edit.on ? (
                              <div role="group" aria-label="Edit account" style={css("display: flex; flex-direction: column; gap: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 14px")}>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ae-name" style={css(V.fieldLabel)}>Account name</label>
                                  <input id="ae-name" type="text" autoComplete="off" value={V.adm.acct.edit.name} onChange={V.adm.acct.edit.onName} style={css(V.fieldInput)} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ae-email" style={css(V.fieldLabel)}>Contact email</label>
                                  <input id="ae-email" type="email" autoComplete="off" placeholder="name@company.com" value={V.adm.acct.edit.email} onChange={V.adm.acct.edit.onEmail} style={css(V.fieldInput)} />
                                </div>
                                <div role="group" aria-labelledby="ae-type-label" style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <p id="ae-type-label" style={css(V.fieldLabel)}>Account type</p>
                                  <div style={css("display: flex; gap: 8px")}>
                                    {(V.adm.acct.edit.types || []).map((et, et__i) => (
                                      <button key={et__i} type="button" aria-pressed={et.pressed} onClick={et.pick} style={css(et.style)}>{et.label}</button>
                                    ))}
                                  </div>
                                  {V.adm.acct.edit.typeNote ? <p style={css("margin: 0; font-size: 12px; line-height: 1.4; color: var(--muted)")}>{V.adm.acct.edit.typeNote}</p> : null}
                                </div>
                                {V.adm.acct.edit.hasErr ? <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.adm.acct.edit.err}</p> : null}
                                <div style={css("display: flex; justify-content: flex-end; gap: 8px")}>
                                  <button type="button" className="fb-ni" onClick={V.adm.acct.edit.cancel} style={css(V.ui.btnGhost)}>Cancel</button>
                                  <button type="button" onClick={V.adm.acct.edit.save} style={css(V.ui.btnPrimary)}>{V.adm.acct.edit.saveLabel}</button>
                                </div>
                              </div>
                            ) : null}
                            {" "}
                            <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                              <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                                <p style={css("margin: 0; font-size: 13px; font-weight: 600; color: var(--ink-2)")}>{V.adm.acct.projectsLabel}</p>
                                {/* app: link an unsponsored project to this sponsor */}
                                {V.adm.acct.link.show ? <button type="button" className="fb-ni" aria-expanded={V.adm.acct.link.exp} onClick={V.adm.acct.link.toggle} style={css(V.ui.ghostSm)}>{V.adm.acct.link.open ? "Done" : "Link project"}</button> : null}
                              </div>
                              {V.adm.acct.link.open ? (
                                <div style={css("display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 12px")}>
                                  <label htmlFor="link-q" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search projects to link</label>
                                  <input id="link-q" type="search" autoComplete="off" placeholder="Search unsponsored projects" value={V.adm.acct.link.q} onChange={V.adm.acct.link.onQ} style={css(V.fieldInput)} />
                                  <div role="list" aria-label="Projects to link" style={css("display: flex; flex-direction: column")}>
                                    {(V.adm.acct.link.items || []).map((li, li__i) => (
                                      <div role="listitem" key={li__i}>
                                        <button type="button" className="mitem" onClick={li.pick} aria-label={"Link " + li.title} style={css("width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; text-align: left; cursor: pointer")}>
                                          <span style={css("font-size: 14px; color: var(--ink)")}>{li.title}</span>
                                          <span style={css("font-size: 12px; color: var(--muted-2)")}>{li.sub}</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  {V.adm.acct.link.empty ? <p style={css("margin: 0; padding: 4px 8px; font-size: 13px; color: var(--muted)")}>{V.adm.acct.link.emptyText}</p> : null}
                                  {V.adm.acct.link.more ? <p style={css("margin: 0; padding: 0 8px; font-size: 12px; color: var(--muted-2)")}>{V.adm.acct.link.more}</p> : null}
                                </div>
                              ) : null}
                              {(V.adm.acct.projects || []).map((ap2, ap2__i) => (
                                <Fragment key={ap2__i}>
                                  <div style={css("display: flex; flex-direction: column; gap: 4px; padding: 6px 0; border-bottom: 1px solid var(--line)")}>
                                    <div style={css("display: flex; align-items: center; gap: 8px; min-height: 36px")}>
                                      <span style={css("flex: 1; min-width: 0; font-size: 14px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{ap2.title}</span>
                                      {" "}
                                      {ap2.hasApproval ? <span title="Sponsor approval" style={css(ap2.approvalStyle)}>{ap2.approval}</span> : null}
                                      <span style={css(ap2.statusStyle)}>{ap2.status}</span>
                                      {" "}
                                      <button type="button" className="fb-ni" aria-label={ap2.aria} onClick={ap2.open} style={css(V.ui.ghostSm)}>Open</button>
                                      {ap2.canUnlink ? <button type="button" className="fb-ni" aria-label={ap2.unlinkAria} onClick={ap2.unlink} style={css(V.ui.ghostSm + " color: var(--red-ink);")}>{ap2.unlinkLabel}</button> : null}
                                    </div>
                                    {ap2.hasDeliverables ? <p style={css("margin: 0; font-size: 12px; line-height: 1.4; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden")}>{ap2.deliverables}</p> : null}
                                    {ap2.unlinkNote ? <p role="status" style={css("margin: 0; font-size: 12px; color: var(--red-ink)")}>{ap2.unlinkNote}</p> : null}
                                  </div>
                                </Fragment>
                              ))}
                              {V.adm.acct.noProjects ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.acct.emptyText}</p> : null}
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                              <p style={css("margin: 0 0 4px; font-size: 13px; font-weight: 600; color: var(--ink-2)")}>Access</p>
                              {" "}
                              {(V.adm.acct.access || []).map((ax, ax__i) => (
                                <Fragment key={ax__i}>
                                  <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                                    <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; color: var(--ink)")}>{ax.label}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2)")}>{ax.desc}</span>
                                    </span>
                                    {" "}
                                    <button type="button" role="switch" aria-checked={ax.on} aria-label={ax.label} onClick={ax.toggle} style={css(V.ui.swBtn)}>
                                      <span aria-hidden="true" style={css(ax.track)}>
                                        <span style={css(ax.knob)}></span>
                                      </span>
                                    </button>
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-wrap: wrap; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              {V.adm.acct.canResend ? (
                                <>
                                  <button type="button" onClick={V.adm.acct.resend} style={css(V.ui.btnGhost)}>{V.adm.acct.resendLabel}</button>
                                </>
                              ) : null}
                              {" "}
                              <button type="button" onClick={V.adm.acct.remove} style={css(V.ui.btnDanger)}>{V.adm.acct.removeLabel}</button>
                            </div>
                          </aside>
                        </>
                      ) : null}
                    </div>
                    {" "}
                    {V.adm.acctModal ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.adm.closeAcct} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                        {" "}
                        <dialog open aria-modal="true" aria-labelledby="acct-modal-title" style={css(V.ui.dialog)}>
                          <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}>
                            <div>
                              <h2 id="acct-modal-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Add account</h2>
                              {" "}
                              <p style={css("margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)")}>Clients own a channel. Sponsors attach to individual projects.</p>
                            </div>
                            {" "}
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.adm.closeAcct} style={css(V.ui.iconBtn)}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6 6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                          {" "}
                          <div style={css("display: flex; flex-direction: column; gap: 18px")}>
                            <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <label htmlFor="acct-name" style={css(V.fieldLabel)}>Account name</label>
                              {" "}
                              <input id="acct-name" type="text" autoComplete="off" placeholder="Brand or channel name" onChange={V.adm.onAcctName} style={css(V.fieldInput)} />
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <label htmlFor="acct-email" style={css(V.fieldLabel)}>Contact email</label>
                              {" "}
                              <input id="acct-email" type="email" autoComplete="off" placeholder="name@company.com" onChange={V.adm.onAcctEmail} style={css(V.fieldInput)} />
                            </div>
                            {" "}
                            <div role="radiogroup" aria-labelledby="acct-type-label" style={css("display: flex; flex-direction: column; gap: 8px")}>
                              <p id="acct-type-label" style={css(V.fieldLabel)}>Account type</p>
                              {" "}
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 8px")}>
                                {(V.adm.acctTypes || []).map((ty, ty__i) => (
                                  <Fragment key={ty__i}>
                                    <label className="fb-radio" style={css(ty.style)}>
                                      <input type="radio" name="acct-type" checked={!!ty.on} onChange={ty.pick} style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; opacity: 0")} />
                                      {" "}
                                      <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px")}>
                                        <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{ty.label}</span>
                                        {" "}
                                        <span style={css("font-size: 12px; line-height: 1.4; color: var(--muted)")}>{ty.blurb}</span>
                                      </span>
                                      {" "}
                                      <span aria-hidden="true" style={css(ty.radioStyle)}></span>
                                    </label>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                            {" "}
                            {/* app: send the portal invite as soon as the account is added */}
                            <label style={css("display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ink); cursor: pointer")}>
                              <input type="checkbox" checked={!!V.adm.naInvite} onChange={V.adm.onNaInvite} style={css("width: 16px; height: 16px; margin: 0; accent-color: var(--ink)")} />
                              Send portal invite now
                            </label>
                            {" "}
                            {V.adm.hasAcctErr ? (
                              <>
                                <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.adm.acctErr}</p>
                              </>
                            ) : null}
                          </div>
                          {" "}
                          <div style={css("display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px")}>
                            <button type="button" className="fb-ni" onClick={V.adm.closeAcct} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            {" "}
                            <button type="button" onClick={V.adm.addAcct} style={css(V.ui.btnPrimary)}>Add account</button>
                          </div>
                        </dialog>
                      </>
                    ) : null}
                  </>
                ) : null}
                {" "}
                {V.adm.isFinance ? (
                  <>
                    <div role="group" aria-label="Finance section" style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      {(V.adm.finTabs || []).map((ft, ft__i) => (
                        <Fragment key={ft__i}>
                          <button type="button" className="fb-ni" aria-pressed={ft.pressed} onClick={ft.pick} style={css(ft.style)}>
                            <span>{ft.label}</span>
                            {" "}
                            <span style={css(ft.badge)}>{ft.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    {/* app: focusable so the table can be scrolled by keyboard when it has no rows (QA a11y: scrollable-region-focusable) */}
                    <div tabIndex={0} role="region" aria-label={V.adm.fin.label} style={css("position: relative; overflow-x: auto; padding-bottom: 8px")}>
                      <div role="table" aria-label={V.adm.fin.label} style={css(V.adm.fin.wrapStyle)}>
                        <div role="row" style={css(V.adm.fin.headStyle)}>
                          {(V.adm.fin.head || []).map((fh, fh__i) => (
                            <Fragment key={fh__i}>
                              <span role="columnheader" style={css(fh.style)}>{fh.label}{fh.srLabel ? <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{fh.srLabel}</span> : null}</span>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        {(V.adm.fin.rows || []).map((fr, fr__i) => (
                          <Fragment key={fr__i}>
                            <div role="row" className="row" style={css(V.adm.fin.rowStyle)}>
                              {(fr.cells || []).map((fc, fc__i) => (
                                <Fragment key={fc__i}>
                                  <div role="cell" style={css(fc.style)}>
                                    {fc.isText ? (
                                      <>
                                        <span style={css(fc.textStyle)}>{fc.text}</span>
                                      </>
                                    ) : null}
                                    {" "}
                                    {fc.isSub ? (
                                      <>
                                        <span style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}>
                                          <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{fc.text}</span>
                                          <span style={css("font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{fc.sub}</span>
                                        </span>
                                      </>
                                    ) : null}
                                    {" "}
                                    {fc.isBlock ? (
                                      <>
                                        <span style={css(fc.blockStyle)}>{fc.text}</span>
                                      </>
                                    ) : null}
                                    {" "}
                                    {fc.isPerson ? (
                                      <>
                                        <span aria-hidden="true" style={css(fc.avatarStyle)}>{fc.initials}</span>
                                        <span style={css("display: flex; flex-direction: column; min-width: 0")}>
                                          <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{fc.text}</span>
                                          <span style={css("font-size: 12px; color: var(--muted-2)")}>{fc.sub}</span>
                                        </span>
                                      </>
                                    ) : null}
                                    {" "}
                                    {fc.isBar ? (
                                      <>
                                        <span aria-hidden="true" style={css("flex: 1; height: 8px; background: var(--chip-2)")}>
                                          <span style={css(fc.barStyle)}></span>
                                        </span>
                                        <span style={css(fc.barTextStyle)}>{fc.text}</span>
                                      </>
                                    ) : null}
                                    {" "}
                                    {fc.isAction ? (
                                      <>
                                        <button type="button" className="fb-ni" aria-label={fc.aria} onClick={fc.pick} style={css(fc.btnStyle)}>{fc.text}</button>
                                      </>
                                    ) : null}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </Fragment>
                        ))}
                        {/* app: empty finance tables say how to start */}
                        {V.adm.fin.empty ? <p style={css("margin: 0; padding: 20px 16px; font-size: 14px; color: var(--muted); border-bottom: 1px solid var(--line)")}>{V.adm.fin.emptyText}</p> : null}
                        {" "}
                        <div role="row" style={css(V.adm.fin.totalStyle)}>
                          {(V.adm.fin.total || []).map((ftot, ftot__i) => (
                            <Fragment key={ftot__i}>
                              <span role="cell" style={css(ftot.style)}>{ftot.text}</span>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.adm.isAuto ? (
                  <>
                    <div style={css("display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line)")}>
                      <div role="tablist" aria-label="Automation sections" style={css("display: flex; gap: 24px; margin-bottom: -1px; overflow-x: auto")}>
                        {(V.adm.wfTabs || []).map((wt2, wt2__i) => (
                          <Fragment key={wt2__i}>
                            <button type="button" role="tab" className="fb-tab" id={wt2.id} aria-selected={wt2.selected} onClick={wt2.pick} style={css(wt2.style)}>
                              <span>{wt2.label}</span>
                              {" "}
                              {wt2.hasCount ? (
                                <>
                                  <span style={css(V.ui.countPill)}>{wt2.count}</span>
                                </>
                              ) : null}
                            </button>
                          </Fragment>
                        ))}
                      </div>
                      {" "}
                      {V.adm.isWfTab ? (
                        <>
                          <div style={css("position: relative; display: flex; align-items: center; flex: 0 1 280px; margin-bottom: 10px")}>
                            <label htmlFor="wf-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search workflows</label>
                            {" "}
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                            </svg>
                            {" "}
                            <input id="wf-search" type="search" placeholder="Search workflows" onChange={V.adm.onWfSearch} style={css(V.ui.search)} />
                          </div>
                        </>
                      ) : null}
                    </div>
                    {" "}
                    {V.adm.isWfTab ? (
                      <>
                        <div role="group" aria-label="Workflow status" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 4px")}>
                          <span style={css("margin-right: 6px; font-size: 13px; font-weight: 600; color: var(--muted-2)")}>Status</span>
                          {" "}
                          {(V.adm.wfStatus || []).map((ws2, ws2__i) => (
                            <Fragment key={ws2__i}>
                              <button type="button" className="fb-ni" aria-pressed={ws2.pressed} onClick={ws2.pick} style={css(ws2.style)}>
                                <span>{ws2.label}</span>
                                <span style={css(ws2.badge)}>{ws2.count}</span>
                              </button>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        {V.adm.allPaused ? (
                          <>
                            <div role="status" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 16px 14px 20px; border: 1px solid var(--line); border-left: 0; border-radius: 16px; background: var(--amber-soft); color: var(--amber-ink)")}>
                              <span style={css("flex: 1 1 240px; font-size: 14px; font-weight: 600")}>All automations are paused. Nothing runs until you resume.</span>
                              {" "}
                              <button type="button" onClick={V.adm.resumeAll} style={css(V.ui.btnGhost)}>Resume all</button>
                            </div>
                          </>
                        ) : null}
                        {" "}
                        {(V.adm.wfSections || []).map((sec2, sec2__i) => (
                          <Fragment key={sec2__i}>
                            <section aria-labelledby={sec2.hid} style={css("display: flex; flex-direction: column; gap: 14px")}>
                              <div style={css("display: flex; align-items: center; gap: 12px")}>
                                <span aria-hidden="true" style={css(sec2.tileStyle)}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={sec2.icon}></path>
                                  </svg>
                                </span>
                                {" "}
                                <h2 id={sec2.hid} style={css(V.ui.h2)}>{sec2.title}</h2>
                                {" "}
                                <span style={css(V.ui.countPill)}>{sec2.countText}</span>
                                {" "}
                                <span style={css("flex: 1")}></span>
                                {" "}
                                <span style={css("font-size: 13px; color: var(--muted-2)")}>{sec2.desc}</span>
                              </div>
                              {" "}
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 16px")}>
                                {(sec2.items || []).map((wc, wc__i) => (
                                  <Fragment key={wc__i}>
                                    <article className="fb-card" style={css(wc.cardStyle)}>
                                      <div aria-hidden="true" style={css("position: relative; height: 150px; background: var(--surface-2); border-bottom: 1px solid var(--line); overflow: hidden")}>
                                        <svg viewBox="0 0 1000 150" preserveAspectRatio="none" style={css("position: absolute; inset: 0; width: 100%; height: 100%")}>
                                          <path d={wc.path} fill="none" stroke="var(--border-strong)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"></path>
                                        </svg>
                                        {" "}
                                        {(wc.nodes || []).map((nd, nd__i) => (
                                          <Fragment key={nd__i}>
                                            <span style={css(nd.style)}></span>
                                          </Fragment>
                                        ))}
                                        {" "}
                                        <span style={css(wc.chipL)}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v3a3 3 0 0 0 3 3h6"></path>
                                          </svg>
                                          Workflow
                                        </span>
                                        {" "}
                                        <span style={css(wc.chipR)}>{wc.app}</span>
                                      </div>
                                      {" "}
                                      <div style={css("display: flex; flex-direction: column; gap: 10px; padding: 14px 12px 16px 18px")}>
                                        <div style={css("display: flex; align-items: center; gap: 4px")}>
                                          <h3 style={css(wc.titleStyle)}>{wc.name}</h3>
                                          {" "}
                                          <button type="button" role="switch" aria-checked={wc.on} aria-label={wc.aria} onClick={wc.toggle} style={css(V.ui.swBtn)}>
                                            <span aria-hidden="true" style={css(wc.track)}>
                                              <span style={css(wc.knob)}></span>
                                            </span>
                                          </button>
                                          {" "}
                                          {/* app: edit the workflow's trigger, actions and messages */}
                                          <button type="button" className="fb-ni" aria-label={wc.editAria} title="Edit" onClick={wc.edit} style={css("height: 40px; min-width: 40px; flex: none; padding: 0; border: 0; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; color: var(--muted-2)")}>
                                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                                          </button>
                                          <button type="button" className="fb-ni" aria-label={wc.delAria} onClick={wc.del} style={css(wc.delStyle)}>
                                            {wc.confirming ? (
                                              <>
                                                <span style={css("font-size: 13px; font-weight: 600")}>Delete?</span>
                                              </>
                                            ) : null}
                                            {" "}
                                            {wc.notConfirming ? (
                                              <>
                                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                                </svg>
                                              </>
                                            ) : null}
                                          </button>
                                        </div>
                                        {" "}
                                        <p style={css("margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden")}>
                                          <span style={css("font-weight: 600; color: var(--ink-3)")}>When</span>
                                          {" "}{wc.when}{". "}
                                          <span style={css("font-weight: 600; color: var(--ink-3)")}>Then</span>
                                          {" "}{wc.then}.
                                        </p>
                                        {" "}
                                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-right: 6px")}>
                                          <span style={css(wc.statusStyle)}>{wc.status}</span>
                                          {" "}
                                          <span style={css("font-size: 13px; color: var(--muted-2)")}>{wc.steps}</span>
                                          {" "}
                                          <span style={css("flex: 1")}></span>
                                          {" "}
                                          <span style={css("display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted-2); font-variant-numeric: tabular-nums")}>
                                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                              <circle cx="12" cy="12" r="9"></circle>
                                              <path d="M12 7v5l3 2"></path>
                                            </svg>
                                            {wc.last}
                                          </span>
                                        </div>
                                      </div>
                                    </article>
                                  </Fragment>
                                ))}
                              </div>
                            </section>
                          </Fragment>
                        ))}
                        {" "}
                        {V.adm.wfEmpty ? (
                          <>
                            <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No workflows match. Clear the search or pick another status.</p>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {" "}
                    {/* app: automation run history (automation_runs) */}
                    {V.adm.isRunTab ? (
                      <>
                        <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                          {(V.adm.runTabs || []).map((rt) => (
                            <button key={rt.label} type="button" aria-pressed={rt.pressed} onClick={rt.pick} style={css(rt.style)}>{rt.label}<span style={css(rt.badge)}>{rt.count}</span></button>
                          ))}
                        </div>
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.runsNote}</p>
                        {V.adm.runsEmpty ? <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No runs yet. A run appears here when a live workflow&apos;s trigger happens, or when you test a workflow.</p> : null}
                        <ol style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden" + (V.adm.runsEmpty ? "; display: none" : ""))}>
                          {(V.adm.runs || []).map((ru, ru__i) => (
                            <li key={ru.id} style={css("display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 14px; padding: 14px 16px;" + (ru__i ? " border-top: 1px solid var(--line);" : ""))}>
                              <span style={css(ru.statusStyle + " flex: none; min-width: 76px; justify-content: center;")}>{ru.status}</span>
                              <div style={css("flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 4px")}>
                                <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{ru.name}</span>
                                <span style={css("font-size: 13px; color: var(--muted)")}>
                                  {ru.trigger}
                                  {ru.hasProject ? <>{"  ·  "}<button type="button" onClick={ru.openProject} style={css("padding: 0; border: 0; background: transparent; font: inherit; color: var(--ink-3); text-decoration: underline; cursor: pointer")}>{ru.project}</button></> : null}
                                </span>
                                {(ru.steps || []).map((st, st__i) => <span key={st__i} style={css(st.style)}>{st.text}</span>)}
                                {ru.hasError ? <span style={css("font-size: 13px; line-height: 1.45; color: var(--red-ink)")}>{ru.error}</span> : null}
                              </div>
                              <div style={css("flex: none; display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted-2); white-space: nowrap")}>
                                {ru.next ? <span>{ru.next}</span> : null}
                                {ru.tries ? <span>{ru.tries}</span> : null}
                                <span>{ru.when}</span>
                                {ru.canRetry ? <button type="button" onClick={ru.retry} style={css(V.ui.ghostSm + " border: 1px solid var(--border);")}>Retry</button> : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                        {V.adm.runsMore ? <button type="button" onClick={V.adm.showMoreRuns} style={css(V.ui.btnGhost + " align-self: flex-start;")}>Show more runs</button> : null}
                      </>
                    ) : null}
                    {" "}
                    {V.adm.isConnTab ? (
                      <>
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.connNote}</p>
                        {" "}
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 16px")}>
                          {(V.adm.integrations || []).map((ig, ig__i) => (
                            <Fragment key={ig__i}>
                              <article style={css("display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface)")}>
                                <div style={css("display: flex; align-items: center; gap: 12px")}>
                                  <span aria-hidden="true" style={css(ig.tileStyle)}>{ig.initials}</span>
                                  {" "}
                                  <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                    <span style={css("font-size: 15px; font-weight: 600; color: var(--ink)")}>{ig.name}</span>
                                    <span style={css("font-size: 12px; color: var(--muted-2)")}>{ig.usedBy}</span>
                                  </span>
                                  {" "}
                                  <span style={css(ig.statusStyle)}>{ig.status}</span>
                                </div>
                                {" "}
                                <p style={css("margin: 0; flex: 1; font-size: 13px; line-height: 1.45; color: var(--muted)")}>{ig.desc}</p>
                                {" "}
                                <button type="button" aria-label={ig.aria} onClick={ig.toggle} style={css(ig.btnStyle)}>{ig.btn}</button>
                              </article>
                            </Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {" "}
                    {V.adm.isSetTab ? (
                      <>
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 16px; align-items: start")}>
                          <section aria-labelledby="run-h" style={css(V.ui.panel)}>
                            <h2 id="run-h" style={css(V.ui.h3)}>Run settings</h2>
                            {" "}
                            {(V.adm.runSettings || []).map((rs, rs__i) => (
                              <Fragment key={rs__i}>
                                <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                                  <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                    <span style={css("font-size: 14px; color: var(--ink)")}>{rs.label}</span>
                                    <span style={css("font-size: 12px; color: var(--muted-2)")}>{rs.desc}</span>
                                  </span>
                                  {" "}
                                  <button type="button" role="switch" aria-checked={rs.on} aria-label={rs.label} onClick={rs.toggle} style={css(V.ui.swBtn)}>
                                    <span aria-hidden="true" style={css(rs.track)}>
                                      <span style={css(rs.knob)}></span>
                                    </span>
                                  </button>
                                </div>
                              </Fragment>
                            ))}
                            {" "}
                            <div style={css("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                <label htmlFor="auto-ret" style={css("font-size: 14px; color: var(--ink)")}>Run history</label>
                                <span style={css("font-size: 12px; color: var(--muted-2)")}>How long run logs are kept</span>
                              </span>
                              {" "}
                              <div style={css(V.dd.autoRet.wrap)} onKeyDown={V.dd.autoRet.onKey}>
                                <button type="button" id="auto-ret" aria-haspopup="listbox" aria-expanded={V.dd.autoRet.exp} aria-label={V.dd.autoRet.aria} onClick={V.dd.autoRet.toggle} style={css(V.dd.autoRet.btn)}>
                                  <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.autoRet.value}</span>
                                  {" "}
                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.autoRet.chev)}>
                                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                  </svg>
                                </button>
                                {" "}
                                {V.dd.autoRet.open ? (
                                  <>
                                    <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.autoRet.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                    {" "}
                                    <div role="listbox" aria-label={V.dd.autoRet.label} style={css(V.dd.autoRet.pop)}>
                                      {(V.dd.autoRet.items || []).map((ddo, ddo__i) => (
                                        <Fragment key={ddo__i}>
                                          <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                            <span style={css(ddo.check)}>
                                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3.5 8.5l3 3 6-7"></path>
                                              </svg>
                                            </span>
                                            {" "}
                                            <span style={css("flex: 1")}>{ddo.label}</span>
                                          </button>
                                        </Fragment>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </section>
                          {" "}
                          <section aria-labelledby="nt-h" style={css("display: flex; flex-direction: column; gap: 12px; min-width: 0")}>
                            <h2 id="nt-h" style={css(V.ui.h3)}>Notifications</h2>
                            {" "}
                            <div style={css("position: relative; overflow-x: auto; padding-bottom: 8px")}>
                              <div role="table" aria-label="Notification channels" style={css("min-width: 520px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                                <div role="row" style={css(`${V.adm.ntGrid ?? ''} min-height: 44px`)}>
                                  <span role="columnheader" style={css(V.thStyle)}>Event</span>
                                  {" "}
                                  {(V.adm.ntHead || []).map((nh, nh__i) => (
                                    <Fragment key={nh__i}>
                                      <span role="columnheader" style={css(nh.style)}>{nh.label}</span>
                                    </Fragment>
                                  ))}
                                </div>
                                {" "}
                                {(V.adm.notif || []).map((nt, nt__i) => (
                                  <Fragment key={nt__i}>
                                    <div role="row" className="row" style={css(V.adm.ntRow)}>
                                      <span role="cell" style={css("padding: 0 16px; font-size: 14px; color: var(--ink)")}>{nt.label}</span>
                                      {" "}
                                      {(nt.cells || []).map((nc, nc__i) => (
                                        <Fragment key={nc__i}>
                                          <div role="cell" style={css("display: flex; justify-content: center")}>
                                            {/* app: events with no email show a dash instead of a checkbox */}
                                            {nc.na ? (
                                              <span title="Not available" style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted-2)")}>
                                                <span aria-hidden="true">–</span>
                                                <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{nc.aria}</span>
                                              </span>
                                            ) : (
                                            <label style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                                              <input type="checkbox" checked={!!nc.on} onChange={nc.pick} style={css("width: 18px; height: 18px; margin: 0; accent-color: var(--ink); cursor: pointer")} />
                                              {" "}
                                              <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{nc.aria}</span>
                                            </label>
                                            )}
                                          </div>
                                        </Fragment>
                                      ))}
                                    </div>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          </section>
                        </div>
                      </>
                    ) : null}
                    {" "}
                  </>
                ) : null}
                {" "}
                {V.adm.isLogs ? (
                  <>
                    <div style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      <div style={css("position: relative; display: flex; align-items: center; flex: 1 1 200px; max-width: 280px; margin-right: 4px")}>
                        <label htmlFor="log-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search activity</label>
                        {" "}
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                        </svg>
                        {" "}
                        <input id="log-search" type="search" placeholder="Search people or projects" onChange={V.adm.onLogSearch} style={css(V.ui.search)} />
                      </div>
                      {" "}
                      {(V.adm.logTabs || []).map((lt, lt__i) => (
                        <Fragment key={lt__i}>
                          <button type="button" className="fb-ni" aria-pressed={lt.pressed} onClick={lt.pick} style={css(lt.style)}>
                            <span aria-hidden="true" style={css(lt.swatch)}></span>
                            {" "}
                            <span>{lt.label}</span>
                            {" "}
                            <span style={css(lt.badge)}>{lt.count}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    {(V.adm.logGroups || []).map((lg, lg__i) => (
                      <Fragment key={lg__i}>
                        <section aria-label={lg.title} style={css("display: flex; flex-direction: column; gap: 10px")}>
                          <div style={css("display: flex; align-items: center; gap: 10px")}>
                            <h2 style={css(V.ui.h3)}>{lg.title}</h2>
                            {" "}
                            <span style={css(V.ui.countPill)}>{lg.countText}</span>
                          </div>
                          {" "}
                          <div style={css("position: relative; overflow-x: auto; padding-bottom: 4px")}>
                            <div role="table" aria-label={lg.title} style={css("min-width: 860px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                              {(lg.items || []).map((li, li__i) => (
                                <Fragment key={li__i}>
                                  <div role="row" className="row" style={css(li.rowStyle)}>
                                    <span role="cell" style={css("padding: 0 16px; font-size: 13px; color: var(--muted-2); white-space: nowrap; font-variant-numeric: tabular-nums")}>{li.time}</span>
                                    {" "}
                                    <div role="cell" style={css("display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 16px")}>
                                      <span aria-hidden="true" style={css(li.avatarStyle)}>{li.initials}</span>
                                      {" "}
                                      <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{li.who}</span>
                                    </div>
                                    {" "}
                                    <div role="cell" style={css("padding: 0 16px")}>
                                      <span style={css(li.catStyle)}>{li.cat}</span>
                                    </div>
                                    {" "}
                                    <span role="cell" style={css("padding: 10px 16px; font-size: 14px; line-height: 1.45; color: var(--ink-3); min-width: 0")}>
                                      <span>{li.text}</span>
                                      {" "}
                                      <span style={css("font-weight: 600; color: var(--ink)")}>{li.target}</span>
                                    </span>
                                    {" "}
                                    <span role="cell" style={css("padding: 0 16px; font-size: 12px; font-weight: 600; color: var(--muted-2); white-space: nowrap")}>{li.source}</span>
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </section>
                      </Fragment>
                    ))}
                    {" "}
                    {V.adm.logEmpty ? (
                      <>
                        <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No activity matches these filters.</p>
                      </>
                    ) : null}
                    {/* app: Activity Log pages past the newest 400 */}
                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px")}>
                      <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.logCount}</p>
                      {V.adm.canLoadOlder ? <button type="button" disabled={V.adm.logBusy} onClick={V.adm.loadOlder} style={css(V.ui.btnGhost)}>{V.adm.logBusy ? 'Loading…' : 'Load older'}</button> : null}
                    </div>
                  </>
                ) : null}
                {" "}
                {/* app: What's New, every release in lib/studio/releases.js, newest first */}
                {V.adm.isUpdates ? (
                  <div style={css("display: flex; flex-direction: column; gap: 16px; max-width: 760px")}>
                    {(V.adm.releases || []).map((r) => (
                      <article key={r.id} aria-labelledby={'rel-' + r.id} style={css("padding: 20px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 4px")}>
                          <span style={css("font-size: 13px; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{r.date}</span>
                          {r.latest ? <span style={css(V.ui.countPill)}>Latest</span> : null}
                        </div>
                        <h2 id={'rel-' + r.id} style={css(V.ui.h3)}>{r.title}</h2>
                        <ul style={css("margin: 12px 0 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.5; color: var(--ink-3)")}>
                          {r.items.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : null}
                {" "}
                {V.adm.isWorkspace ? (
                  <>
                    <div style={css("display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start")}>
                      <nav aria-label="Settings sections" style={css("flex: 0 0 200px; display: flex; flex-direction: column; gap: 4px")}>
                        {(V.adm.wsTabs || []).map((wt, wt__i) => (
                          <Fragment key={wt__i}>
                            <button type="button" className="fb-ni" aria-current={wt.current} onClick={wt.pick} style={css(wt.style)}>{wt.label}</button>
                          </Fragment>
                        ))}
                      </nav>
                      {" "}
                      <div style={css("flex: 1 1 520px; min-width: 0; display: flex; flex-direction: column; gap: 20px")}>
                        {V.adm.wsGeneral ? (
                          <>
                            <section aria-labelledby="ws-gen" style={css(V.ui.panel)}>
                              <h2 id="ws-gen" style={css(V.ui.h3)}>General</h2>
                              {" "}
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 18px")}>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-name" style={css(V.fieldLabel)}>Workspace name</label>
                                  {" "}
                                  <input id="ws-name" type="text" value={V.adm.ws.name ?? ''} onChange={V.adm.ws.onName} style={css(V.fieldInput)} />
                                </div>
                                {" "}
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-tz" style={css(V.fieldLabel)}>Time zone</label>
                                  {" "}
                                  <div style={css(V.dd.wsTz.wrap)} onKeyDown={V.dd.wsTz.onKey}>
                                    <button type="button" id="ws-tz" aria-haspopup="listbox" aria-expanded={V.dd.wsTz.exp} aria-label={V.dd.wsTz.aria} onClick={V.dd.wsTz.toggle} style={css(V.dd.wsTz.btn)}>
                                      <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.wsTz.value}</span>
                                      {" "}
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.wsTz.chev)}>
                                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                      </svg>
                                    </button>
                                    {" "}
                                    {V.dd.wsTz.open ? (
                                      <>
                                        <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.wsTz.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                        {" "}
                                        <div role="listbox" aria-label={V.dd.wsTz.label} style={css(V.dd.wsTz.pop)}>
                                          {(V.dd.wsTz.items || []).map((ddo, ddo__i) => (
                                            <Fragment key={ddo__i}>
                                              <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                                <span style={css(ddo.check)}>
                                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3.5 8.5l3 3 6-7"></path>
                                                  </svg>
                                                </span>
                                                {" "}
                                                <span style={css("flex: 1")}>{ddo.label}</span>
                                              </button>
                                            </Fragment>
                                          ))}
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                {" "}
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-view" style={css(V.fieldLabel)}>Default board view</label>
                                  {" "}
                                  <div style={css(V.dd.wsView.wrap)} onKeyDown={V.dd.wsView.onKey}>
                                    <button type="button" id="ws-view" aria-haspopup="listbox" aria-expanded={V.dd.wsView.exp} aria-label={V.dd.wsView.aria} onClick={V.dd.wsView.toggle} style={css(V.dd.wsView.btn)}>
                                      <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.wsView.value}</span>
                                      {" "}
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.wsView.chev)}>
                                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                      </svg>
                                    </button>
                                    {" "}
                                    {V.dd.wsView.open ? (
                                      <>
                                        <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.wsView.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                        {" "}
                                        <div role="listbox" aria-label={V.dd.wsView.label} style={css(V.dd.wsView.pop)}>
                                          {(V.dd.wsView.items || []).map((ddo, ddo__i) => (
                                            <Fragment key={ddo__i}>
                                              <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                                <span style={css(ddo.check)}>
                                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3.5 8.5l3 3 6-7"></path>
                                                  </svg>
                                                </span>
                                                {" "}
                                                <span style={css("flex: 1")}>{ddo.label}</span>
                                              </button>
                                            </Fragment>
                                          ))}
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                {" "}
                                <div role="radiogroup" aria-labelledby="ws-week" style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <p id="ws-week" style={css(V.fieldLabel)}>Week starts on</p>
                                  {" "}
                                  <div style={css("display: flex; gap: 4px; padding: 4px; background: var(--track); border-radius: 14px; align-self: flex-start")}>
                                    {(V.adm.ws.weeks || []).map((wk, wk__i) => (
                                      <Fragment key={wk__i}>
                                        <button type="button" role="radio" aria-checked={wk.on} onClick={wk.pick} style={css(wk.style)}>{wk.label}</button>
                                      </Fragment>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.adm.wsStatuses ? (
                          <>
                            <section aria-labelledby="ws-st" style={css(V.ui.panel)}>
                              <h2 id="ws-st" style={css(V.ui.h3)}>Project statuses</h2>
                              {" "}
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>Order matches the workflow. Each status maps to a board stage.</p>
                              {" "}
                              <div style={css("display: flex; flex-direction: column; margin: 0 -20px; border-top: 1px solid var(--line)")}>
                                {(V.adm.ws.statuses || []).map((ss, ss__i) => (
                                  <Fragment key={ss__i}>
                                    <div className="row" style={css("display: grid; grid-template-columns: 32px minmax(0, 1fr) 150px 110px 56px; align-items: center; min-height: 56px; padding: 0 12px 0 20px; border-bottom: 1px solid var(--line)")}>
                                      <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{ss.n}</span>
                                      {" "}
                                      <span>
                                        <span style={css(ss.style)}>{ss.label}</span>
                                      </span>
                                      {" "}
                                      <span style={css("font-size: 13px; color: var(--ink-3)")}>{ss.stage}</span>
                                      {" "}
                                      <span style={css("font-size: 13px; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{ss.used}</span>
                                      {" "}
                                      <span style={css("display: flex; justify-content: flex-end")}>
                                        {ss.canRemove ? (
                                          <>
                                            <button type="button" className="fb-ni" aria-label={ss.aria} onClick={ss.remove} style={css(V.ui.iconBtn)}>
                                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                <path d="M18 6 6 18M6 6l12 12"></path>
                                              </svg>
                                            </button>
                                          </>
                                        ) : null}
                                      </span>
                                    </div>
                                  </Fragment>
                                ))}
                              </div>
                              {" "}
                              <div style={css("display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px")}>
                                <div style={css("flex: 1 1 200px; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-new-status" style={css(V.fieldLabel)}>New status</label>
                                  {" "}
                                  <input id="ws-new-status" type="text" autoComplete="off" placeholder="Status name" value={V.adm.ws.newStatus ?? ''} onChange={V.adm.ws.onNewStatus} style={css(V.fieldInput)} />
                                </div>
                                {" "}
                                <div style={css("flex: 0 1 180px; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-new-stage" style={css(V.fieldLabel)}>Stage</label>
                                  {" "}
                                  <div style={css(V.dd.wsNewStage.wrap)} onKeyDown={V.dd.wsNewStage.onKey}>
                                    <button type="button" id="ws-new-stage" aria-haspopup="listbox" aria-expanded={V.dd.wsNewStage.exp} aria-label={V.dd.wsNewStage.aria} onClick={V.dd.wsNewStage.toggle} style={css(V.dd.wsNewStage.btn)}>
                                      <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.wsNewStage.value}</span>
                                      {" "}
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.wsNewStage.chev)}>
                                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                      </svg>
                                    </button>
                                    {" "}
                                    {V.dd.wsNewStage.open ? (
                                      <>
                                        <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.wsNewStage.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                        {" "}
                                        <div role="listbox" aria-label={V.dd.wsNewStage.label} style={css(V.dd.wsNewStage.pop)}>
                                          {(V.dd.wsNewStage.items || []).map((ddo, ddo__i) => (
                                            <Fragment key={ddo__i}>
                                              <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                                <span style={css(ddo.check)}>
                                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3.5 8.5l3 3 6-7"></path>
                                                  </svg>
                                                </span>
                                                {" "}
                                                <span style={css("flex: 1")}>{ddo.label}</span>
                                              </button>
                                            </Fragment>
                                          ))}
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                {" "}
                                <button type="button" onClick={V.adm.ws.addStatus} style={css(V.ui.btnGhost)}>Add status</button>
                              </div>
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.adm.wsFields ? (
                          <>
                            <section aria-labelledby="ws-cf" style={css(V.ui.panel)}>
                              <h2 id="ws-cf" style={css(V.ui.h3)}>Custom fields</h2>
                              {" "}
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>Extra columns on the board. Turn one off the board to keep its values without showing it, and pick which user types can see each one.</p>
                              {" "}
                              <div style={css("position: relative; overflow-x: auto; margin: 0 -20px")}>
                                <div role="table" aria-label="Custom fields" style={css("min-width: 700px; border-top: 1px solid var(--line)")}>
                                  <div role="row" style={css("display: grid; grid-template-columns: minmax(180px, 1fr) 130px 80px minmax(260px, 1.4fr) 56px; align-items: center; min-height: 40px; border-bottom: 1px solid var(--line); padding-left: 4px")}>
                                    <span role="columnheader" style={css(V.thStyle)}>Field</span>
                                    {" "}
                                    <span role="columnheader" style={css(V.thStyle)}>Type</span>
                                    {" "}
                                    <span role="columnheader" style={css(V.thStyle)}>On board</span>
                                    {" "}
                                    <span role="columnheader" style={css(V.thStyle)}>Visible to</span>
                                    {" "}
                                    <span role="columnheader" style={css(V.thStyle)}>
                                      <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Actions</span>
                                    </span>
                                  </div>
                                  {" "}
                                  {(V.adm.ws.fields || []).map((cf, cf__i) => (
                                    <Fragment key={cf__i}>
                                      <div role="row" className="row" style={css("display: grid; grid-template-columns: minmax(180px, 1fr) 130px 80px minmax(260px, 1.4fr) 56px; align-items: center; min-height: 56px; border-bottom: 1px solid var(--line); padding-left: 4px")}>
                                        <span role="cell" style={css("padding: 0 16px; font-size: 14px; font-weight: 600; color: var(--ink)")}>{cf.label}</span>
                                        {" "}
                                        <span role="cell" style={css("padding: 0 16px")}>
                                          <span style={css(V.viewChip)}>{cf.type}</span>
                                        </span>
                                        {" "}
                                        <span role="cell" style={css("padding: 0 8px")}>
                                          <button type="button" role="switch" aria-checked={cf.board.on} aria-label={cf.board.aria} onClick={cf.board.toggle} style={css(V.ui.swBtn)}>
                                            <span aria-hidden="true" style={css(cf.board.track)}><span style={css(cf.board.knob)}></span></span>
                                          </button>
                                        </span>
                                        {" "}
                                        <div role="cell" style={css("display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px")}>
                                          {(cf.roles || []).map((cr, cr__i) => (
                                            <Fragment key={cr__i}>
                                              <button type="button" aria-pressed={cr.pressed} aria-label={cr.aria} onClick={cr.pick} style={css(cr.style)}>{cr.label}</button>
                                            </Fragment>
                                          ))}
                                        </div>
                                        {" "}
                                        <span role="cell" style={css("display: flex; justify-content: flex-end; padding-right: 8px")}>
                                          <button type="button" className="fb-ni" aria-label={cf.aria} onClick={cf.remove} style={css(V.ui.iconBtn)}>
                                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                              <path d="M18 6 6 18M6 6l12 12"></path>
                                            </svg>
                                          </button>
                                        </span>
                                      </div>
                                    </Fragment>
                                  ))}
                                </div>
                              </div>
                              {" "}
                              <div style={css("display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px")}>
                                <div style={css("flex: 1 1 200px; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-new-field" style={css(V.fieldLabel)}>New field</label>
                                  {" "}
                                  <input id="ws-new-field" type="text" autoComplete="off" placeholder="Field name" value={V.adm.ws.newField ?? ''} onChange={V.adm.ws.onNewField} style={css(V.fieldInput)} />
                                </div>
                                {" "}
                                <div style={css("flex: 0 1 180px; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ws-new-ftype" style={css(V.fieldLabel)}>Type</label>
                                  {" "}
                                  <div style={css(V.dd.wsNewFtype.wrap)} onKeyDown={V.dd.wsNewFtype.onKey}>
                                    <button type="button" id="ws-new-ftype" aria-haspopup="listbox" aria-expanded={V.dd.wsNewFtype.exp} aria-label={V.dd.wsNewFtype.aria} onClick={V.dd.wsNewFtype.toggle} style={css(V.dd.wsNewFtype.btn)}>
                                      <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.wsNewFtype.value}</span>
                                      {" "}
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.wsNewFtype.chev)}>
                                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                      </svg>
                                    </button>
                                    {" "}
                                    {V.dd.wsNewFtype.open ? (
                                      <>
                                        <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.wsNewFtype.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                        {" "}
                                        <div role="listbox" aria-label={V.dd.wsNewFtype.label} style={css(V.dd.wsNewFtype.pop)}>
                                          {(V.dd.wsNewFtype.items || []).map((ddo, ddo__i) => (
                                            <Fragment key={ddo__i}>
                                              <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                                <span style={css(ddo.check)}>
                                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3.5 8.5l3 3 6-7"></path>
                                                  </svg>
                                                </span>
                                                {" "}
                                                <span style={css("flex: 1")}>{ddo.label}</span>
                                              </button>
                                            </Fragment>
                                          ))}
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                {" "}
                                <button type="button" onClick={V.adm.ws.addField} style={css(V.ui.btnGhost)}>Add field</button>
                              </div>
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.adm.wsTemplates ? (
                          <>
                            <section aria-labelledby="ws-tp" style={css("display: flex; flex-direction: column; gap: 12px")}>
                              <h2 id="ws-tp" style={css(V.ui.h3)}>Project templates</h2>
                              {" "}
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 12px")}>
                                {(V.adm.ws.templates || []).map((tp, tp__i) => (
                                  <Fragment key={tp__i}>
                                    <article style={css("display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                                      <span style={css(tp.typeStyle)}>{tp.type}</span>
                                      {" "}
                                      <h3 style={css("margin: 0; font-size: 16px; font-weight: 600; color: var(--ink)")}>{tp.name}</h3>
                                      {" "}
                                      <dl style={css("margin: 0; display: flex; flex-direction: column; gap: 8px")}>
                                        {(tp.facts || []).map((tf, tf__i) => (
                                          <Fragment key={tf__i}>
                                            <div style={css("display: flex; justify-content: space-between; gap: 12px; font-size: 13px")}>
                                              <dt style={css("color: var(--muted-2)")}>{tf.label}</dt>
                                              {" "}
                                              <dd style={css("margin: 0; font-weight: 600; color: var(--ink-2); text-align: right")}>{tf.value}</dd>
                                            </div>
                                          </Fragment>
                                        ))}
                                      </dl>
                                      {" "}
                                      <button type="button" aria-label={tp.editAria} onClick={tp.edit} style={css(V.ui.btnGhost)}>Edit template</button>
                                    </article>
                                  </Fragment>
                                ))}
                              </div>
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.adm.wsInteg ? (
                          <>
                            {/* app: integration keys, one card per provider grouped by purpose. Super Admin only. */}
                            <div style={css("display: flex; flex-direction: column; gap: 24px; min-width: 0")}>
                              <section aria-labelledby="ws-in" style={css(V.ui.panel)}>
                                <h2 id="ws-in" style={css(V.ui.h3)}>Integrations</h2>
                                <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.adm.ws.integNote}</p>
                                <button type="button" onClick={V.adm.ws.goAuto} style={css(V.ui.btnGhostStart)}>Use them in Automations</button>
                              </section>
                              {(V.adm.ws.integGroups || []).map((igg) => (
                                <section key={igg.id} aria-labelledby={igg.hid} style={css("display: flex; flex-direction: column; gap: 12px; min-width: 0")}>
                                  <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                                    <h2 id={igg.hid} style={css(V.ui.h3)}>{igg.title}</h2>
                                    <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{igg.desc}</p>
                                  </div>
                                  <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start")}>
                                    {igg.cards.map((ic) => (
                                      <article key={ic.id} id={'ig-card-' + ic.id} tabIndex={-1} aria-label={ic.name + ' connection settings'} style={css("display: flex; flex-direction: column; gap: 14px; padding: 18px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); min-width: 0")}>
                                        <div style={css("display: flex; align-items: center; gap: 12px")}>
                                          <span aria-hidden="true" style={css(ic.tileStyle)}>{ic.initials}</span>
                                          <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                            <span style={css("font-size: 15px; font-weight: 600; color: var(--ink)")}>{ic.name}</span>
                                            <span style={css("font-size: 12px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{ic.keyNote}</span>
                                          </span>
                                          <span style={css(ic.statusStyle)}>{ic.status}</span>
                                        </div>
                                        <p style={css("margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted)")}>{ic.desc}</p>
                                        {ic.setupNote ? <p style={css("margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted-2)")}>{ic.setupNote}</p> : null}
                                        {ic.hasErr ? (
                                          <p role="alert" style={css("margin: 0; font-size: 13px; line-height: 1.45; color: var(--red-ink)")}>{ic.err}</p>
                                        ) : null}
                                        {ic.isAi ? (
                                          <button type="button" aria-pressed={ic.aiOn} onClick={ic.aiPick} style={css(ic.aiStyle)}>{ic.aiLabel}</button>
                                        ) : null}
                                        <form onSubmit={(e) => { e.preventDefault(); ic.save(); }} style={css("display: flex; flex-direction: column; gap: 12px; margin: 0")}>
                                          {ic.fields.map((fl) => (
                                            <div key={fl.id} style={css("display: flex; flex-direction: column; gap: 6px")}>
                                              <label htmlFor={fl.id} style={css(V.fieldLabel)}>{fl.label}</label>
                                              {fl.isSelect ? (
                                                <select id={fl.id} disabled={ic.disabled} value={fl.value} onChange={fl.onInput} style={css(V.fieldInput)}>
                                                  {fl.options.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                  ))}
                                                </select>
                                              ) : (
                                                <input id={fl.id} disabled={ic.disabled} type={fl.type} value={fl.value} onChange={fl.onInput} placeholder={fl.placeholder} autoComplete={fl.auto} spellCheck={false} style={css(V.fieldInput)} />
                                              )}
                                              {fl.hasHelp ? (
                                                <span style={css("font-size: 12px; line-height: 1.4; color: var(--muted-2)")}>{fl.help}</span>
                                              ) : null}
                                            </div>
                                          ))}
                                          <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                            <button type="submit" disabled={ic.disabled} aria-label={ic.saveAria} style={css(V.ui.btnPrimary)}>{ic.saveLabel}</button>
                                            {ic.canSync ? (
                                              <button type="button" disabled={ic.disabled} aria-label={ic.syncAria} onClick={ic.sync} style={css(V.ui.btnGhost)}>{ic.syncLabel}</button>
                                            ) : null}
                                            {ic.canDisconnect ? (
                                              <button type="button" disabled={ic.disabled} aria-label={ic.disconnectAria} onClick={ic.disconnect} style={css(V.ui.btnDanger)}>Disconnect</button>
                                            ) : null}
                                          </div>
                                        </form>
                                        <div style={css("display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px")}>
                                          <a href={ic.keyUrl} target="_blank" rel="noreferrer" style={css("color: var(--link); text-decoration: underline; text-underline-offset: 3px")}>{ic.credentialLabel}</a>
                                          <a href={ic.docs} target="_blank" rel="noreferrer" style={css("color: var(--link); text-decoration: underline; text-underline-offset: 3px")}>API docs</a>
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </section>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
          {" "}
          {V.isDaily ? (
            <>
              <div style={css("display: flex; align-items: stretch; min-height: calc(100vh - 110px)")}>
                <aside className="fb-chathist" aria-label="Chat history" style={css("flex: none; width: 280px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; padding: 20px 12px 16px; border-right: 1px solid var(--line)")}>
                  <button type="button" onClick={V.chat.newChat} style={css("min-height: 44px; width: 100%; padding: 0 16px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); display: inline-flex; align-items: center; gap: 10px; cursor: pointer")}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                    </svg>
                    {" New chat "}
                  </button>
                  {" "}
                  <div style={css("position: relative; display: flex; align-items: center")}>
                    <label htmlFor="chat-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search chats</label>
                    {" "}
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                    </svg>
                    {" "}
                    <input id="chat-search" type="search" placeholder="Search chats" onChange={V.chat.onSearch} style={css(V.ui.search)} />
                  </div>
                  {" "}
                  <div style={css("flex: 1 1 auto; min-height: 0; max-height: calc(100vh - 250px); overflow-y: auto; display: flex; flex-direction: column; gap: 18px; padding-top: 6px")}>
                    {(V.chat.groups || []).map((cg, cg__i) => (
                      <Fragment key={cg__i}>
                        <div role="group" aria-label={cg.title} style={css("display: flex; flex-direction: column; gap: 2px")}>
                          <p style={css("margin: 0; padding: 0 12px 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-2)")}>{cg.title}</p>
                          {" "}
                          {(cg.items || []).map((ch, ch__i) => (
                            <Fragment key={ch__i}>
                              <button type="button" className="fb-ni" aria-current={ch.current} onClick={ch.pick} style={css(ch.style)}>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none; margin-top: 2px")}>
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                {" "}
                                <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px")}>
                                  <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{ch.title}</span>
                                  {" "}
                                  <span style={css("font-size: 12px; font-weight: 400; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{ch.preview}</span>
                                </span>
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      </Fragment>
                    ))}
                    {" "}
                    {V.chat.noHistory ? (
                      <>
                        <p style={css("margin: 0; padding: 0 12px; font-size: 13px; color: var(--muted)")}>No chats match.</p>
                      </>
                    ) : null}
                  </div>
                </aside>
                {" "}
                <section aria-label="Assistant" style={css("flex: 1 1 0; min-width: 0; display: flex; flex-direction: column")}>
                  <header style={css("flex: none; display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 24px; box-sizing: border-box; border-bottom: 1px solid var(--line)")}>
                    <span aria-hidden="true" style={css(V.chat.markSm)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"></path>
                      </svg>
                    </span>
                    {" "}
                    <h1 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h5); font-weight: var(--weight-black); letter-spacing: -0.02em; color: var(--ink)")}>Daily</h1>
                    {" "}
                    <span style={css("font-size: 13px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{V.chat.subtitle}</span>
                    {" "}
                    <span style={css("flex: 1")}></span>
                    {" "}
                    <span style={css("font-size: 13px; color: var(--muted-2); white-space: nowrap")}>{V.todayLong}</span>
                    {/* app: AI settings (models, API keys, answer mode, instructions) */}
                    <GearButton onClick={V.chat.settings.show} />
                  </header>
                  {V.chat.settings.open ? <AiSettings d={V.chat.settings} /> : null}
                  {" "}
                  {V.chat.isEmpty ? (
                    <>
                      <div style={css("flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; padding: 40px 24px 48px; box-sizing: border-box")}>
                        <div className="fb-float" style={css("display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center")}>
                          <span aria-hidden="true" style={css(V.chat.markLg)}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"></path>
                            </svg>
                          </span>
                          {" "}
                          <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h2); font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.03em; color: var(--ink)")}>{V.chat.greeting}</h2>
                          {" "}
                          <p style={css("margin: 0; max-width: 460px; font-size: var(--text-body-sm); color: var(--muted)")}>{V.chat.sub}</p>
                        </div>
                        {" "}
                        <div role="list" aria-label="Today at a glance" style={css("width: 100%; max-width: 880px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 12px")}>
                          {(V.chat.cards || []).map((kc, kc__i) => (
                            <Fragment key={kc__i}>
                              <div role="listitem" className="fb-float" style={css(kc.style)}>
                                <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                                  <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2)")}>{kc.label}</span>
                                  {" "}
                                  <span aria-hidden="true" style={css(kc.iconStyle)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d={kc.icon}></path>
                                    </svg>
                                  </span>
                                </div>
                                {" "}
                                <span style={css("font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1; letter-spacing: -0.03em; color: var(--ink); font-variant-numeric: tabular-nums")}>{kc.value}</span>
                                {" "}
                                {kc.isBar ? (
                                  <>
                                    <span aria-hidden="true" style={css("display: block; height: 6px; background: var(--chip-2)")}>
                                      <span style={css(kc.barStyle)}></span>
                                    </span>
                                  </>
                                ) : null}
                                {" "}
                                {kc.isSeg ? (
                                  <>
                                    <span aria-hidden="true" style={css("display: flex; gap: 3px; height: 6px")}>
                                      {(kc.segs || []).map((sg, sg__i) => (
                                        <Fragment key={sg__i}>
                                          <span style={css(sg.style)}></span>
                                        </Fragment>
                                      ))}
                                    </span>
                                  </>
                                ) : null}
                                {" "}
                                {kc.isChips ? (
                                  <>
                                    <span aria-hidden="true" style={css("display: flex; gap: 3px; height: 6px")}>
                                      {(kc.chips || []).map((cp, cp__i) => (
                                        <Fragment key={cp__i}>
                                          <span style={css(cp.style)}></span>
                                        </Fragment>
                                      ))}
                                    </span>
                                  </>
                                ) : null}
                                {" "}
                                {kc.isSpark ? (
                                  <>
                                    <svg aria-hidden="true" viewBox="0 0 120 24" preserveAspectRatio="none" style={css("display: block; width: 100%; height: 24px; margin: -9px 0 -3px")}>
                                      <polyline points={kc.spark} fill="none" stroke={kc.sparkColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"></polyline>
                                    </svg>
                                  </>
                                ) : null}
                                {" "}
                                <span style={css("font-size: 12px; line-height: 1.4; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{kc.sub}</span>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        <div className="fb-composer" style={css(V.chat.composerStyle)}>
                          <label htmlFor="chat-input" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Message the assistant</label>
                          {" "}
                          {/* app: multi-line composer; Enter sends, Shift+Enter adds a line */}
                          <textarea id="chat-input" className="fb-chatin" rows={V.chat.rows} autoComplete="off" placeholder={V.chat.placeholder} value={V.chat.draft ?? ''} onChange={V.chat.onDraft} onKeyDown={V.chat.onKey} style={css(V.chat.inputStyle)} />
                          {" "}
                          <div style={css("display: flex; align-items: center; gap: 6px")}>
                            {/* app: model picker and Fast / Think toggle; the scope chip when no model is connected */}
                            {V.chat.hasPicker ? <ModelPicker p={V.chat.picker} /> : (
                              <span title={V.chat.scopeTitle} style={css(V.chat.scopeChip)}>
                                <span aria-hidden="true" style={css(V.chat.scopeDot)}></span>
                                {V.chat.scope}
                              </span>
                            )}
                            {V.chat.hasMode ? <ModeToggle m={V.chat.modeCtl} /> : null}
                            {" "}
                            <span style={css("flex: 1")}></span>
                            {" "}
                            <button type="button" className="fb-ni" aria-label={V.chat.dictateLabel} aria-pressed={V.chat.dictating} title={V.chat.dictateLabel} onClick={V.chat.dictate} style={css(V.chat.micBtn)}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"></path>
                              </svg>
                            </button>
                            {" "}
                            {/* app: Stop replaces Send while an answer is generating */}
                            {V.chat.busy ? (
                              <button type="button" aria-label="Stop generating" title="Stop" onClick={V.chat.stop} style={css(V.chat.stopBtn)}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
                              </button>
                            ) : (
                              <button type="button" aria-label="Send message" onClick={V.chat.send} style={css(V.chat.sendBtn)}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 19V5M5 12l7-7 7 7"></path>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {" "}
                        <div role="group" aria-label="Quick actions" style={css("width: 100%; max-width: 760px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 10px")}>
                          {(V.chat.quick || []).map((qa, qa__i) => (
                            <Fragment key={qa__i}>
                              <button type="button" className="fb-qa" onClick={qa.pick} style={css(V.chat.qaStyle)}>
                                <span aria-hidden="true" style={css(qa.tileStyle)}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={qa.icon}></path>
                                  </svg>
                                </span>
                                {" "}
                                <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); text-align: left; line-height: 1.3")}>{qa.label}</span>
                              </button>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        {V.chat.hasAttn ? (
                          <>
                            <section aria-labelledby="attn-h" style={css("width: 100%; max-width: 760px; margin-top: 28px; text-align: left")}>
                              <h2 id="attn-h" style={css("margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--muted-2)")}>Needs attention</h2>
                              {" "}
                              <div style={css("border: 1px solid var(--line-4); border-radius: 16px; overflow: hidden; background: var(--surface)")}>
                                {(V.chat.attn || []).map((at, at__i) => (
                                  <Fragment key={at__i}>
                                    <button type="button" className="fb-day" onClick={at.open} aria-label={at.aria} style={css(at.rowStyle)}>
                                      <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                        <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{at.title}</span>
                                        {" "}
                                        <span style={css("font-size: 13px; color: var(--muted)")}>{at.meta}</span>
                                      </span>
                                      {" "}
                                      <span style={css(at.tagStyle)}>{at.tag}</span>
                                    </button>
                                  </Fragment>
                                ))}
                              </div>
                            </section>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  {" "}
                  {V.chat.hasMsgs ? (
                    <>
                      {/* app: ChatScroll follows the newest text unless the member scrolled up */}
                      <ChatScroll chatKey={V.chat.subtitle} style={css("flex: 1 1 auto; min-height: 0; max-height: calc(100vh - 290px); overflow-y: auto; padding: 28px 24px 12px; box-sizing: border-box")}>
                        <ol aria-label="Conversation" aria-live="polite" aria-busy={V.chat.busy ? 'true' : 'false'} style={css("max-width: 760px; margin: 0 auto; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 24px")}>
                          {(V.chat.msgs || []).map((mg, mg__i) => (
                            <Fragment key={mg__i}>
                              <li style={css(mg.wrapStyle)}>
                                {mg.isUser ? (
                                  <>
                                    <p style={css("margin: 0; max-width: 520px; padding: 12px 16px; border-radius: 18px 18px 4px 18px; background: var(--chip-2); font-size: 15px; line-height: 1.5; color: var(--ink)")}>{mg.text}</p>
                                  </>
                                ) : null}
                                {" "}
                                {mg.isAi ? (
                                  <>
                                    <span aria-hidden="true" style={css(V.chat.markSm)}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"></path>
                                      </svg>
                                    </span>
                                    {" "}
                                    <div className={mg.isLast ? 'fb-aimsg fb-aimsg-last' : 'fb-aimsg'} style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px")}>
                                      {/* app: model replies: Thinking block, tool steps, then the reply as light markdown (ChatKit.jsx) */}
                                      {mg.thinking ? <Thinking t={mg.thinking} /> : null}
                                      {mg.steps.length ? <Steps steps={mg.steps} /> : null}
                                      {mg.waiting ? <p className="fb-shimmer" style={css("margin: 6px 0 0; font-size: 15px; font-weight: 600")}>{mg.waiting}</p> : null}
                                      {mg.rich ? <RichText text={mg.rich} live={mg.live} /> : null}
                                      {/* app: rule-based replies keep the single paragraph */}
                                      {mg.text ? <p style={css("margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink-2)")}>{mg.text}</p> : null}
                                      {(mg.blocks || []).map((bk, bk__i) => (
                                        <Fragment key={'bk' + bk__i}>
                                          {bk.isList ? (
                                            <ul style={css(bk.style)}>
                                              {(bk.items || []).map((li, li__i) => (<li key={li__i}>{li}</li>))}
                                            </ul>
                                          ) : (
                                            <p style={css(bk.style)}>{bk.text}</p>
                                          )}
                                        </Fragment>
                                      ))}
                                      {/* app: assistant proposals; only the member's click on the button creates anything */}
                                      {(mg.cards || []).map((pc, pc__i) => (
                                        <section key={'pc' + pc__i} aria-label={pc.kindLabel + ': ' + pc.title} style={css(pc.cardStyle)}>
                                          <span style={css("font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-2)")}>{pc.kindLabel}</span>
                                          <span style={css("font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--ink); overflow-wrap: anywhere")}>{pc.title}</span>
                                          {pc.fields.length ? (
                                            <dl style={css("margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 13px; line-height: 1.4")}>
                                              {pc.fields.map((f, f__i) => (
                                                <Fragment key={f__i}>
                                                  <dt style={css("color: var(--muted-2)")}>{f.label}</dt>
                                                  <dd style={css("margin: 0; color: var(--ink-2); overflow-wrap: anywhere")}>{f.value}</dd>
                                                </Fragment>
                                              ))}
                                            </dl>
                                          ) : null}
                                          {pc.hasLines ? (
                                            <ul style={css("margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.45; color: var(--ink-2); overflow-wrap: anywhere")}>
                                              {pc.lines.map((ln, ln__i) => (<li key={ln__i}>{ln}</li>))}
                                            </ul>
                                          ) : null}
                                          <div style={css("display: flex; align-items: center; gap: 12px; flex-wrap: wrap")}>
                                            <button type="button" onClick={pc.act} disabled={pc.disabled} aria-disabled={pc.disabled ? 'true' : 'false'} style={css(pc.btnStyle)}>{pc.btnLabel}</button>
                                            <span style={css("font-size: 12px; color: var(--muted-2)")}>{pc.note}</span>
                                          </div>
                                        </section>
                                      ))}
                                      {" "}
                                      {mg.hasItems ? (
                                        <>
                                          <div style={css("display: flex; flex-direction: column; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface); overflow: hidden")}>
                                            {(mg.items || []).map((it, it__i) => (
                                              <Fragment key={it__i}>
                                                <button type="button" className="row" onClick={it.open} aria-label={it.aria} style={css(it.rowStyle)}>
                                                  <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px")}>
                                                    <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{it.title}</span>
                                                    {" "}
                                                    <span style={css("font-size: 12px; font-weight: 400; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{it.meta}</span>
                                                  </span>
                                                  {" "}
                                                  <span style={css(it.tagStyle)}>{it.tag}</span>
                                                  {" "}
                                                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none")}>
                                                    <path d="M9 18l6-6-6-6"></path>
                                                  </svg>
                                                </button>
                                              </Fragment>
                                            ))}
                                          </div>
                                        </>
                                      ) : null}
                                      {" "}
                                      {mg.hasBullets ? (
                                        <>
                                          <ul style={css("margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.55; color: var(--ink-2)")}>
                                            {(mg.bullets || []).map((bl, bl__i) => (
                                              <Fragment key={bl__i}>
                                                <li>{bl}</li>
                                              </Fragment>
                                            ))}
                                          </ul>
                                        </>
                                      ) : null}
                                      {" "}
                                      {mg.hasFoot ? (
                                        <>
                                          <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>{mg.foot}</p>
                                        </>
                                      ) : null}
                                      {mg.actions ? <MsgActions a={mg.actions} /> : null}
                                    </div>
                                  </>
                                ) : null}
                              </li>
                            </Fragment>
                          ))}
                        </ol>
                      </ChatScroll>
                      {" "}
                      <div style={css("flex: none; padding: 12px 24px 24px; display: flex; flex-direction: column; align-items: center; gap: 8px")}>
                        <div className="fb-composer" style={css(V.chat.composerStyle)}>
                          <label htmlFor="chat-input" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Message the assistant</label>
                          {" "}
                          {/* app: multi-line composer; Enter sends, Shift+Enter adds a line */}
                          <textarea id="chat-input" className="fb-chatin" rows={V.chat.rows} autoComplete="off" placeholder="Reply to the assistant" value={V.chat.draft ?? ''} onChange={V.chat.onDraft} onKeyDown={V.chat.onKey} style={css(V.chat.inputStyle)} />
                          {" "}
                          <div style={css("display: flex; align-items: center; gap: 6px")}>
                            {/* app: model picker and Fast / Think toggle; the scope chip when no model is connected */}
                            {V.chat.hasPicker ? <ModelPicker p={V.chat.picker} /> : (
                              <span title={V.chat.scopeTitle} style={css(V.chat.scopeChip)}>
                                <span aria-hidden="true" style={css(V.chat.scopeDot)}></span>
                                {V.chat.scope}
                              </span>
                            )}
                            {V.chat.hasMode ? <ModeToggle m={V.chat.modeCtl} /> : null}
                            {" "}
                            <span style={css("flex: 1")}></span>
                            {" "}
                            <button type="button" className="fb-ni" aria-label={V.chat.dictateLabel} aria-pressed={V.chat.dictating} title={V.chat.dictateLabel} onClick={V.chat.dictate} style={css(V.chat.micBtn)}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"></path>
                              </svg>
                            </button>
                            {" "}
                            {/* app: Stop replaces Send while an answer is generating */}
                            {V.chat.busy ? (
                              <button type="button" aria-label="Stop generating" title="Stop" onClick={V.chat.stop} style={css(V.chat.stopBtn)}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
                              </button>
                            ) : (
                              <button type="button" aria-label="Send message" onClick={V.chat.send} style={css(V.chat.sendBtn)}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 19V5M5 12l7-7 7 7"></path>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {" "}
                        <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>Answers use live board data for your view.</p>
                      </div>
                    </>
                  ) : null}
                </section>
              </div>
            </>
          ) : null}
          {" "}
          {V.showPage ? (
            <>
              <div className="fb-page" style={css("padding: 32px 40px 40px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px")}>
                <header style={css("display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px")}>
                  <div style={css("display: flex; flex-direction: column; gap: 8px; max-width: 640px")}>
                    <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted-2)")}>{V.pg.eyebrow}</p>
                    {" "}
                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 10px")}>
                      <h1 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h1); font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.03em; color: var(--ink)")}>{V.pg.title}</h1>
                      {" "}
                      {V.pg.hasTag ? (
                        <>
                          <span style={css(V.pg.tagStyle)}>{V.pg.tag}</span>
                        </>
                      ) : null}
                    </div>
                    {" "}
                    <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted)")}>{V.pg.desc}</p>
                  </div>
                  {" "}
                  <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                    {V.pg.hasNote ? (
                      <>
                        <span style={css("font-size: 13px; font-weight: 600; color: var(--muted-2)")}>{V.pg.note}</span>
                      </>
                    ) : null}
                    {" "}
                    {V.pg.hasGhost ? (
                      <>
                        <button type="button" onClick={V.pg.ghostPick} style={css(V.ui.btnGhost)}>{V.pg.ghost}</button>
                      </>
                    ) : null}
                    {" "}
                    {V.pg.hasPrimary ? (
                      <>
                        <button type="button" onClick={V.pg.primaryPick} style={css(V.ui.btnPrimary)}>
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                          </svg>
                          {V.pg.primary}
                          {V.pg.primaryKbd ? <kbd aria-hidden="true" style={css("display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; margin-left: 2px; padding: 0 6px; box-sizing: border-box; border-radius: 6px; background: var(--inv-faint); color: var(--inv); font-family: var(--font-main); font-size: 12px; font-weight: 600")}>{V.pg.primaryKbd}</kbd> : null}
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>
                {" "}
                {V.pg.hasStats ? (
                  <>
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 12px")}>
                      {(V.pg.stats || []).map((st, st__i) => (
                        <Fragment key={st__i}>
                          <div style={css(V.ui.stat)}>
                            <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>{st.label}</span>
                            {" "}
                            <span style={css("font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums")}>{st.value}</span>
                            {" "}
                            <span style={css("font-size: 12px; color: var(--muted-2)")}>{st.sub}</span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
                {" "}
                {V.pg.isAlerts ? (
                  <>
                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      <div role="tablist" aria-label="Inbox sections" style={css("display: flex; gap: 4px; padding: 4px; max-width: 100%; box-sizing: border-box; overflow-x: auto; scrollbar-width: none; background: var(--track); border-radius: 14px")}>
                        {(V.inbox.modes || []).map((md, md__i) => (
                          <Fragment key={md__i}>
                            <button type="button" role="tab" aria-selected={md.selected} onClick={md.pick} style={css(md.style)}>
                              <span>{md.label}</span>
                              <span style={css(md.badge)}>{md.count}</span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                      {" "}
                      {V.inbox.isNotif ? (
                        <>
                          <div role="group" aria-label="Notification filter" style={css("display: flex; flex-wrap: wrap; gap: 4px")}>
                            {(V.inbox.tabs || []).map((ntb, ntb__i) => (
                              <Fragment key={ntb__i}>
                                <button type="button" className="fb-ni" aria-pressed={ntb.pressed} onClick={ntb.pick} style={css(ntb.style)}>
                                  <span>{ntb.label}</span>
                                  {" "}
                                  <span style={css(ntb.badge)}>{ntb.count}</span>
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      ) : null}
                      {/* app: Messages mode filter chips (Slack, later Buffer) */}
                      {V.inbox.isMsgs ? (
                        <div role="group" aria-label="Message filter" style={css("display: flex; flex-wrap: wrap; gap: 4px")}>
                          {(V.inbox.msg.tabs || []).map((mtb, mtb__i) => (
                            <Fragment key={mtb__i}>
                              <button type="button" className="fb-ni" aria-pressed={mtb.pressed} onClick={mtb.pick} style={css(mtb.style)}>
                                <span>{mtb.label}</span>
                                {" "}
                                <span style={css(mtb.badge)}>{mtb.count}</span>
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {" "}
                    {V.inbox.isNotif ? (
                      <>
                        {(V.inbox.groups || []).map((ng, ng__i) => (
                          <Fragment key={ng__i}>
                            <section aria-label={ng.title} style={css("display: flex; flex-direction: column; gap: 10px")}>
                              <h2 style={css(V.ui.h3)}>{ng.title}</h2>
                              {" "}
                              <ul style={css("margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden")}>
                                {(ng.items || []).map((ni, ni__i) => (
                                  <Fragment key={ni__i}>
                                    <li style={css(ni.liStyle)}>
                                      <button type="button" className="row" onClick={ni.open} style={css(ni.btnStyle)}>
                                        <span aria-hidden="true" style={css(ni.dotStyle)}></span>
                                        {" "}
                                        <span aria-hidden="true" style={css(ni.avatarStyle)}>{ni.initials}</span>
                                        {" "}
                                        <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                                          <span style={css("font-size: 14px; font-weight: 400; line-height: 1.45; color: var(--ink-3)")}>
                                            <span style={css("font-weight: 600; color: var(--ink)")}>{ni.who}</span>
                                            {" "}
                                            <span>{ni.text}</span>
                                            {" "}
                                            <span style={css("font-weight: 600; color: var(--ink)")}>{ni.target}</span>
                                          </span>
                                          {" "}
                                          {ni.hasQuote ? (
                                            <>
                                              <span style={css("display: block; padding: 8px 12px; border-left: 3px solid var(--border-strong); background: var(--surface-2); font-size: 13px; font-weight: 400; line-height: 1.45; color: var(--ink-3)")}>{ni.quote}</span>
                                            </>
                                          ) : null}
                                          {" "}
                                          <span style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                            <span style={css(ni.typeStyle)}>{ni.typeLabel}</span>
                                            {" "}
                                            <span style={css("font-size: 12px; font-weight: 400; color: var(--muted-2)")}>{ni.time}</span>
                                            {" "}
                                            {ni.unread ? (
                                              <>
                                                <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Unread</span>
                                              </>
                                            ) : null}
                                          </span>
                                        </span>
                                        {" "}
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none; margin-top: 4px")}>
                                          <path d="M9 18l6-6-6-6"></path>
                                        </svg>
                                      </button>
                                    </li>
                                  </Fragment>
                                ))}
                              </ul>
                            </section>
                          </Fragment>
                        ))}
                        {" "}
                        {V.inbox.empty ? (
                          <>
                            <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>You are all caught up.</p>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {" "}
                    {V.inbox.isActivity ? (
                      <>
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.inbox.actNote}</p>
                        {" "}
                        {V.inbox.showAudit ? (
                          <>
                            <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2)")}>
                              <span aria-hidden="true" style={css("width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--inv); color: var(--inv-ink)")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3"></path>
                                </svg>
                              </span>
                              {" "}
                              <span style={css("flex: 1 1 260px; display: flex; flex-direction: column; gap: 2px")}>
                                <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>Organization-wide audit</span>
                                <span style={css("font-size: 13px; color: var(--muted)")}>Logins, deletions and admin changes across every user live in the Activity Log.</span>
                              </span>
                              {" "}
                              <button type="button" onClick={V.inbox.goLogs} style={css(V.ui.btnGhost)}>Open Activity Log</button>
                            </div>
                          </>
                        ) : null}
                        {" "}
                        {(V.inbox.actGroups || []).map((ag, ag__i) => (
                          <Fragment key={ag__i}>
                            <section aria-label={ag.title} style={css("display: flex; flex-direction: column; gap: 10px")}>
                              <h2 style={css(V.ui.h3)}>{ag.title}</h2>
                              {" "}
                              <ul style={css("margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden")}>
                                {(ag.items || []).map((ai, ai__i) => (
                                  <Fragment key={ai__i}>
                                    <li style={css(ai.liStyle)}>
                                      <button type="button" className="row" onClick={ai.open} style={css(ai.btnStyle)}>
                                        <span aria-hidden="true" style={css(ai.avatarStyle)}>{ai.initials}</span>
                                        {" "}
                                        <span style={css("flex: 1; min-width: 0; font-size: 14px; font-weight: 400; line-height: 1.45; color: var(--ink-3)")}>
                                          <span style={css("font-weight: 600; color: var(--ink)")}>{ai.who}</span>
                                          {" "}
                                          <span>{ai.text}</span>
                                          {" "}
                                          <span style={css("font-weight: 600; color: var(--ink)")}>{ai.target}</span>
                                          {" "}
                                          <span style={css("display: block; margin-top: 2px; font-size: 12px; color: var(--muted-2)")}>{ai.time}</span>
                                        </span>
                                        {" "}
                                        <span style={css(ai.catStyle)}>{ai.cat}</span>
                                      </button>
                                    </li>
                                  </Fragment>
                                ))}
                              </ul>
                            </section>
                          </Fragment>
                        ))}
                        {" "}
                        {V.inbox.actEmpty ? (
                          <>
                            <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No activity on your projects yet.</p>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {/* app: Messages mode, inbox_items from Slack (later Buffer); internal roles only */}
                    {V.inbox.isMsgs ? (
                      <>
                        {(V.inbox.msg.groups || []).map((mg, mg__i) => (
                          <Fragment key={mg__i}>
                            <section aria-label={mg.title} style={css("display: flex; flex-direction: column; gap: 10px")}>
                              <h2 style={css(V.ui.h3)}>{mg.title}</h2>
                              <ul style={css("margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden")}>
                                {(mg.items || []).map((mi, mi__i) => (
                                  <li key={mi__i} style={css(mi.liStyle)}>
                                    <span aria-hidden="true" style={css(mi.dotStyle)}></span>
                                    <span aria-hidden="true" style={css(mi.avatarStyle)}>{mi.initials}</span>
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                                      <span style={css("display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; font-size: 14px; line-height: 1.45")}>
                                        <span style={css("font-weight: 600; color: var(--ink)")}>{mi.who}</span>
                                        <span style={css("font-size: 13px; color: var(--muted)")}>{mi.chan}</span>
                                        {mi.unread ? <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Unread</span> : null}
                                      </span>
                                      <span style={css("font-size: 14px; line-height: 1.45; color: var(--ink-3); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden")}>{mi.text}</span>
                                      <span style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                        <span style={css(mi.srcStyle)}>{mi.srcLabel}</span>
                                        {mi.hasKind ? <span style={css(mi.kindStyle)}>{mi.kindLabel}</span> : null}
                                        <span style={css("font-size: 12px; color: var(--muted-2)")}>{mi.time}</span>
                                      </span>
                                    </span>
                                    <span style={css("flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px")}>
                                      {mi.hasUrl ? (
                                        <a href={mi.url} target="_blank" rel="noopener noreferrer" onClick={mi.open} style={css(mi.linkStyle)}>
                                          {mi.openLabel}
                                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                          </svg>
                                        </a>
                                      ) : null}
                                      {mi.unread ? <button type="button" onClick={mi.markRead} style={css(mi.readStyle)}>Mark read</button> : null}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          </Fragment>
                        ))}
                        {V.inbox.msg.empty ? (
                          <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 24px 0")}>
                            <p style={css("margin: 0; flex: 1 1 260px; font-size: var(--text-body-sm); color: var(--muted)")}>{V.inbox.msg.emptyText}</p>
                            {V.inbox.msg.canConnect ? <button type="button" onClick={V.inbox.msg.goConnect} style={css(V.ui.btnGhost)}>Open Integrations</button> : null}
                          </div>
                        ) : null}
                        {/* app: Buffer gap note for Super Admins (no comments/DMs in Buffer's API) */}
                        {V.inbox.msg.hasNote ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.inbox.msg.note}</p> : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {" "}
                {V.pg.isContent ? (
                  <>
                    {/* app: Videos / Social switch; Social shows Buffer posts */}
                    {V.lib.hasViews ? (
                      <div role="tablist" aria-label="Content views" style={css("display: flex; align-self: flex-start; gap: 4px; padding: 4px; background: var(--track); border-radius: 14px")}>
                        {(V.lib.views || []).map((cvw, cvw__i) => (
                          <button key={cvw__i} type="button" role="tab" aria-selected={cvw.selected} onClick={cvw.pick} style={css(cvw.style)}>
                            <span>{cvw.label}</span>
                            <span style={css(cvw.badge)}>{cvw.count}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {V.lib.isVideos ? (
                    <>
                    <div style={css("display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                      {(V.lib.tabs || []).map((ctb, ctb__i) => (
                        <Fragment key={ctb__i}>
                          <button type="button" className="fb-ni" aria-pressed={ctb.pressed} onClick={ctb.pick} style={css(ctb.style)}>
                            <span aria-hidden="true" style={css(ctb.swatch)}></span>
                            {" "}
                            <span>{ctb.label}</span>
                            {" "}
                            <span style={css(ctb.badge)}>{ctb.count}</span>
                          </button>
                        </Fragment>
                      ))}
                      {" "}
                      <span style={css("flex: 1")}></span>
                      {" "}
                      <label htmlFor="ct-channel" style={css("font-size: 13px; font-weight: 600; color: var(--muted-2); margin-right: 4px")}>Channel</label>
                      {" "}
                      <div style={css(V.dd.ctChannel.wrap)} onKeyDown={V.dd.ctChannel.onKey}>
                        <button type="button" id="ct-channel" aria-haspopup="listbox" aria-expanded={V.dd.ctChannel.exp} aria-label={V.dd.ctChannel.aria} onClick={V.dd.ctChannel.toggle} style={css(V.dd.ctChannel.btn)}>
                          <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.ctChannel.value}</span>
                          {" "}
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.ctChannel.chev)}>
                            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </button>
                        {" "}
                        {V.dd.ctChannel.open ? (
                          <>
                            <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.ctChannel.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                            {" "}
                            <div role="listbox" aria-label={V.dd.ctChannel.label} style={css(V.dd.ctChannel.pop)}>
                              {(V.dd.ctChannel.items || []).map((ddo, ddo__i) => (
                                <Fragment key={ddo__i}>
                                  <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                    <span style={css(ddo.check)}>
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3.5 8.5l3 3 6-7"></path>
                                      </svg>
                                    </span>
                                    {" "}
                                    <span style={css("flex: 1")}>{ddo.label}</span>
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                      {/* app: hand-added cards for posts no sync brings in (content_entries) */}
                      {V.lib.canAdd ? (
                        <button type="button" onClick={V.lib.add} style={css(V.ui.btnPrimary + " min-height: 40px; margin-left: 8px;")}>
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>
                          <span>Add content</span>
                        </button>
                      ) : null}
                    </div>
                    {" "}
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 16px")}>
                      {(V.lib.items || []).map((cv, cv__i) => (
                        <Fragment key={cv__i}>
                          <article style={css("display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); overflow: hidden")}>
                            <div style={css(cv.thumbStyle)}>
                              {/* app: YouTube thumbnail and duration from the sync */}
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, sized by CSS */}
                              {cv.hasImg ? <img src={cv.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={css(V.lib.imgStyle)} /> : null}
                              {cv.hasDur ? <span style={css(cv.durStyle)}>{cv.dur}</span> : null}
                              <span style={css(cv.typeStyle)}>{cv.type}</span>
                              {" "}
                              <span style={css("font-family: var(--font-title); font-size: 20px; font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.02em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden")}>{cv.thumbText}</span>
                              {/* app: banner hook on hand-added cards */}
                              <Hook b={{ showHook: cv.hasHook, hookStyle: cv.hookStyle, hiStyle: cv.hiStyle, hookHi: cv.hookHi, hookRest: cv.hookRest }} />
                              {" "}
                              <span style={css(cv.stateStyle)}>{cv.state}</span>
                            </div>
                            {" "}
                            <div style={css("flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 16px")}>
                              <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                                <h3 style={css("margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; color: var(--ink)")}>{cv.title}</h3>
                                {" "}
                                <span style={css("font-size: 12px; color: var(--muted-2)")}>{cv.meta}</span>
                              </div>
                              {" "}
                              {cv.hasMetrics ? (
                                <>
                                  <dl style={css("margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line)")}>
                                    {(cv.metrics || []).map((mt, mt__i) => (
                                      <Fragment key={mt__i}>
                                        <div style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}>
                                          <dt style={css("font-size: 11px; font-weight: 600; color: var(--muted-2)")}>{mt.label}</dt>
                                          {" "}
                                          <dd style={css("margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums")}>{mt.value}</dd>
                                        </div>
                                      </Fragment>
                                    ))}
                                  </dl>
                                </>
                              ) : null}
                              {" "}
                              {cv.noMetrics ? (
                                <>
                                  <p style={css("margin: 0; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 13px; color: var(--muted)")}>{cv.pendingText}</p>
                                </>
                              ) : null}
                              {" "}
                              <div style={css("display: flex; flex-wrap: wrap; gap: 6px 12px")}>
                                {(cv.dist || []).map((ds, ds__i) => (
                                  <Fragment key={ds__i}>
                                    <span style={css("display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-3)")}>
                                      <span aria-hidden="true" style={css(ds.dotStyle)}></span>
                                      {ds.label}
                                      <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{ds.state}</span>
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                              {" "}
                              <div style={css("display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto")}>
                                {/* app: only link out when the project has a real URL */}
                                {cv.hasLink ? (
                                <a href={cv.href} target="_blank" rel="noopener noreferrer" style={css(V.lib.linkStyle)}>
                                  <span>{cv.linkText}</span>
                                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                    <path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                  </svg>
                                </a>
                                ) : null}
                                {" "}
                                {cv.hasProject ? (
                                  <>
                                    <button type="button" className="fb-ni" aria-label={cv.aria} onClick={cv.open} style={css(V.lib.openBtn)}>Open project</button>
                                  </>
                                ) : null}
                                {cv.canEdit ? <button type="button" className="fb-ni" aria-label={cv.editAria} onClick={cv.edit} style={css(V.lib.openBtn + (cv.hasProject ? " margin-left: 0;" : ""))}>Edit</button> : null}
                              </div>
                            </div>
                          </article>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    {V.lib.empty ? (
                      <>
                        <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>{V.lib.emptyText /* app: says how to get YouTube videos in */}</p>
                      </>
                    ) : null}
                    </>
                    ) : null}
                    {/* app: add or edit a hand-added content card; same layout and parts as New idea */}
                    {V.lib.cm ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.lib.cm.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.45); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="cm-h" onKeyDown={V.lib.cm.onKey} style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 1120px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--ink); font-family: var(--font-main)")}>
                          <header style={css("display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; padding: 28px clamp(16px, 3vw, 28px) 20px; border-bottom: 1px solid var(--line)")}>
                            <div style={css("flex: 1 1 300px; display: flex; flex-direction: column; gap: 6px; min-width: 0")}>
                              <h2 id="cm-h" style={css("margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 24px; letter-spacing: -0.02em")}>{V.lib.cm.heading}</h2>
                              <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>{V.lib.cm.sub}</p>
                            </div>
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.lib.cm.close} style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--ink); cursor: pointer")}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
                            </button>
                          </header>
                          <div style={css("display: flex; flex-wrap: wrap; align-items: flex-start")}>
                            <div style={css("flex: 999 1 520px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 28px; display: flex; flex-direction: column; gap: 28px; border-right: 1px solid var(--line)")}>
                              <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 12px")}>
                                <legend style={css(V.ids.legend)}>Banner</legend>
                                <div role="group" aria-label="Banner style" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                  {(V.lib.cm.covers || []).map((x) => <button key={x.label} type="button" aria-pressed={x.pressed} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                                </div>
                                {V.lib.cm.canUseYt ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>The link is a YouTube video. <button type="button" onClick={V.lib.cm.useYt} style={css("padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--link); text-decoration: underline; text-underline-offset: 3px; cursor: pointer")}>Use its thumbnail</button></p> : null}
                                {V.lib.cm.showDrop ? (
                                  <div onDragOver={V.lib.cm.onDragOver} onDragLeave={V.lib.cm.onDragLeave} onDrop={V.lib.cm.onDrop} style={css(V.lib.cm.dropStyle)}>
                                    <span aria-hidden="true" style={css("width: 48px; height: 48px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--ink)")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path></svg></span>
                                    <p style={css("margin: 0; font-size: 15px; font-weight: 600")}>{V.lib.cm.dropTitle}</p>
                                    <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>JPG, PNG or WebP up to 10 MB. 16:9 works best, 1920×1080 or larger.</p>
                                    {V.lib.cm.ytNote ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.lib.cm.ytNote}</p> : null}
                                    <label htmlFor="cm-file" className="fb-ni fb-filelabel" style={css("position: relative; display: inline-flex; align-items: center; min-height: 40px; margin-top: 4px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; cursor: pointer")}>Browse files<input id="cm-file" type="file" accept="image/*" onChange={V.lib.cm.onFile} style={css("position: absolute; width: 1px; height: 1px; opacity: 0")} /></label>
                                  </div>
                                ) : null}
                                {V.lib.cm.hasImg ? (
                                  <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2)")}>
                                    <span aria-hidden="true" style={css(V.lib.cm.fileThumb)}></span>
                                    <div style={css("flex: 1 1 160px; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{V.lib.cm.fileName}</span>
                                      <span style={css("font-size: 12px; color: var(--muted)")}>Shown on the card in the Content grid.</span>
                                    </div>
                                    <label htmlFor="cm-file2" className="fb-ni fb-filelabel" style={css("position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; cursor: pointer")}>Replace<input id="cm-file2" type="file" accept="image/*" onChange={V.lib.cm.onFile} style={css("position: absolute; width: 1px; height: 1px; opacity: 0")} /></label>
                                    <button type="button" className="fb-ni" onClick={V.lib.cm.removeImg} style={css("min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--red-ink); cursor: pointer")}>Remove</button>
                                  </div>
                                ) : null}
                              </fieldset>
                              <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px")}>
                                <legend style={css(V.ids.legend)}>Basics</legend>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="cm-title" style={css(V.fieldLabel)}>Title</label>
                                  <input id="cm-title" type="text" autoComplete="off" autoFocus placeholder="What was posted?" value={V.lib.cm.title} onChange={V.lib.cm.onTitle} style={css(V.fieldInput + " font-size: 15px;")} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><label htmlFor="cm-hook" style={css(V.fieldLabel)}>Banner hook</label><span style={css("font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums")}>{V.lib.cm.hookCount}</span></div>
                                  <input id="cm-hook" type="text" maxLength="24" autoComplete="off" placeholder="2 to 4 punchy words" value={V.lib.cm.hook} onChange={V.lib.cm.onHook} style={css(V.fieldInput + " font-size: 15px;")} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="cm-channel" style={css(V.fieldLabel)}>Channel</label><DD d={V.dd.cmChannel} id="cm-channel" /></div>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <span id="cm-type-l" style={css(V.fieldLabel)}>Content type</span>
                                  <div role="group" aria-labelledby="cm-type-l" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                    {(V.lib.cm.types || []).map((t) => (
                                      <button key={t.label} type="button" aria-pressed={t.pressed} onClick={t.pick} style={css(t.style)}><span aria-hidden="true" style={css(t.sw)}></span><span>{t.label}</span></button>
                                    ))}
                                  </div>
                                </div>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px")}>
                                  <span id="cm-pl-l" style={css(V.fieldLabel)}>Platform</span>
                                  <div role="group" aria-labelledby="cm-pl-l" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                    {(V.lib.cm.platforms || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.label}</button>)}
                                  </div>
                                </div>
                              </fieldset>
                              <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px")}>
                                <legend style={css(V.ids.legend)}>Publishing</legend>
                                <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                  <span id="cm-st-l" style={css(V.fieldLabel)}>Status</span>
                                  <div role="group" aria-labelledby="cm-st-l" style={css("display: inline-flex; align-self: flex-start; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip-2)")}>
                                    {(V.lib.cm.statuses || []).map((x) => <button key={x.label} type="button" aria-pressed={x.pressed} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                                  </div>
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="cm-date" style={css(V.fieldLabel)}>{V.lib.cm.dateLabel}</label>
                                  <input id="cm-date" type="date" value={V.lib.cm.date} onChange={V.lib.cm.onDate} style={css(V.fieldInput)} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="cm-project" style={css(V.fieldLabel)}>Project</label><DD d={V.dd.cmProject} id="cm-project" /></div>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="cm-url" style={css(V.fieldLabel)}>Link</label>
                                  <input id="cm-url" type="url" autoComplete="off" placeholder="https://… (a YouTube link can supply the banner)" value={V.lib.cm.url} onChange={V.lib.cm.onUrl} style={css(V.fieldInput)} />
                                </div>
                              </fieldset>
                              <fieldset style={css("margin: 0; padding: 20px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface-2); min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 16px")}>
                                <legend style={css(V.ids.legend + " margin: 0; padding: 0 6px;")}>Performance</legend>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="cm-views" style={css(V.fieldLabel)}>Views</label><input id="cm-views" type="text" inputMode="decimal" autoComplete="off" placeholder="12,400 or 12.4k" value={V.lib.cm.views} onChange={V.lib.cm.onViews} style={css(V.fieldInput + " background: var(--surface);")} /></div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="cm-likes" style={css(V.fieldLabel)}>Likes</label><input id="cm-likes" type="text" inputMode="decimal" autoComplete="off" placeholder="Optional" value={V.lib.cm.likes} onChange={V.lib.cm.onLikes} style={css(V.fieldInput + " background: var(--surface);")} /></div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="cm-comments" style={css(V.fieldLabel)}>Comments</label><input id="cm-comments" type="text" inputMode="decimal" autoComplete="off" placeholder="Optional" value={V.lib.cm.comments} onChange={V.lib.cm.onComments} style={css(V.fieldInput + " background: var(--surface);")} /></div>
                                <p style={css("grid-column: 1 / -1; margin: 0; font-size: 12px; color: var(--muted)")}>Leave a stat blank if you do not have it; the card shows a dash rather than zero.</p>
                              </fieldset>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="cm-notes" style={css(V.fieldLabel)}>Notes</label>
                                <textarea id="cm-notes" rows="3" placeholder="Anything worth remembering about this post" value={V.lib.cm.notes} onChange={V.lib.cm.onNotes} style={css(V.ids.textarea + " font-size: 15px;")} />
                              </div>
                            </div>
                            <aside aria-label="Preview" style={css("flex: 1 1 320px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 28px; display: flex; flex-direction: column; gap: 20px; position: sticky; top: 0")}>
                              <p style={css("margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted)")}>Preview</p>
                              <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                                <div style={css(V.lib.cm.thumbStyle)}>
                                  {V.lib.cm.typeLabel ? <span style={css(V.lib.cm.typeStyle)}>{V.lib.cm.typeLabel}</span> : null}
                                  <span style={css("position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: 700; background: var(--surface); color: var(--ink)")}>{V.lib.cm.state}</span>
                                  <Hook b={V.lib.cm} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                                  <span style={css("font-size: 16px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere")}>{V.lib.cm.previewTitle}</span>
                                  <span style={css("font-size: 13px; color: var(--muted)")}>{V.lib.cm.previewMeta}</span>
                                </div>
                                <dl style={css("margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line)")}>
                                  {(V.lib.cm.previewStats || []).map((m) => (
                                    <div key={m.label} style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}><dt style={css("font-size: 11px; font-weight: 600; color: var(--muted-2)")}>{m.label}</dt><dd style={css("margin: 0; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums")}>{m.value}</dd></div>
                                  ))}
                                </dl>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border)")}>
                                <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><span style={css("font-size: 14px; font-weight: 600")}>Card completeness</span><span style={css("font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-3)")}>{V.lib.cm.doneLabel}</span></div>
                                <div role="progressbar" aria-label="Card completeness" aria-valuemin="0" aria-valuemax={V.lib.cm.doneMax} aria-valuenow={V.lib.cm.doneN} style={css("height: 6px; border-radius: 999px; background: var(--border); overflow: hidden")}><div style={css(V.lib.cm.doneBar)}></div></div>
                                <CheckList items={V.lib.cm.checks} gap="6px" />
                              </div>
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted); text-wrap: pretty")}>The card counts toward the Content page totals and filters by its type and channel.</p>
                            </aside>
                          </div>
                          <footer style={css("position: sticky; bottom: 0; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px clamp(16px, 3vw, 28px); border-top: 1px solid var(--line); background: var(--surface-2)")}>
                            {V.lib.cm.showAnother ? <label style={css("display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink-3); cursor: pointer")}><input type="checkbox" checked={V.lib.cm.another} onChange={V.lib.cm.onAnother} style={css("width: 18px; height: 18px; accent-color: var(--ink); margin: 0")} />Add another after this one</label> : null}
                            {V.lib.cm.canDelete ? <button type="button" onClick={V.lib.cm.del} disabled={V.lib.cm.busy} style={css(V.lib.cm.delStyle)}>{V.lib.cm.delLabel}</button> : null}
                            {V.lib.cm.hasErr ? <span role="alert" style={css("font-size: 13px; font-weight: 600; color: var(--red-ink)")}>{V.lib.cm.err}</span> : null}
                            <span style={css("flex: 1")}></span>
                            <span style={css("font-size: 12px; color: var(--muted)")}><kbd style={css("padding: 2px 6px; border: 1px solid var(--border-3); border-radius: 6px; background: var(--surface); font-family: var(--font-main); font-size: 12px")}>⌘ Enter</kbd> to save</span>
                            <button type="button" className="fb-ni" onClick={V.lib.cm.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; font-size: 14px; font-weight: 500; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            <button type="button" onClick={V.lib.cm.save} disabled={V.lib.cm.busy} style={css(V.ui.btnPrimary + (V.lib.cm.busy ? " opacity: 0.6;" : ""))}>{V.lib.cm.saveLabel}</button>
                          </footer>
                        </dialog>
                      </>
                    ) : null}
                    {/* app: Social view, Buffer channels and sent posts with their metrics */}
                    {V.lib.isSocial ? (
                      <>
                        {V.lib.social.hasTabs ? (
                          <div role="group" aria-label="Social channel filter" style={css("display: flex; flex-wrap: wrap; gap: 4px; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                            {(V.lib.social.tabs || []).map((stb, stb__i) => (
                              <button key={stb__i} type="button" className="fb-ni" aria-pressed={stb.pressed} onClick={stb.pick} style={css(stb.style)}>
                                <span>{stb.label}</span>
                                <span style={css(stb.badge)}>{stb.count}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {V.lib.social.hasChannels ? (
                          <section aria-label="Channels, last 30 days" style={css("display: flex; flex-direction: column; gap: 10px")}>
                            <h2 style={css(V.ui.h3)}>Channels, last 30 days</h2>
                            <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 16px")}>
                              {(V.lib.social.channels || []).map((sc, sc__i) => (
                                <button key={sc__i} type="button" aria-pressed={sc.pressed} onClick={sc.pick} style={css(sc.style)}>
                                  <span style={css("display: flex; align-items: center; gap: 10px; min-width: 0")}>
                                    <span aria-hidden="true" style={css(sc.avatarStyle)}>{sc.initials}</span>
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{sc.name}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{sc.sub}</span>
                                    </span>
                                  </span>
                                  {sc.hasWarn ? <span style={css(sc.warnStyle)}>{sc.warn}</span> : null}
                                  <span style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-top: 12px; border-top: 1px solid var(--line)")}>
                                    {(sc.stats || []).map((ss, ss__i) => (
                                      <span key={ss__i} style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}>
                                        <span style={css("font-size: 11px; font-weight: 600; color: var(--muted-2)")}>{ss.label}</span>
                                        <span style={css("font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums")}>{ss.value}</span>
                                      </span>
                                    ))}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </section>
                        ) : null}
                        {V.lib.social.hasItems ? (
                          <section aria-label="Sent posts" style={css("display: flex; flex-direction: column; gap: 10px")}>
                            <h2 style={css(V.ui.h3)}>Sent posts</h2>
                            <ul style={css("margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden")}>
                              {(V.lib.social.items || []).map((sp, sp__i) => (
                                <li key={sp__i} style={css(sp.liStyle)}>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- remote post thumbnail from Buffer, sized by CSS */}
                                  {sp.hasImg ? <img src={sp.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={css(V.lib.social.imgStyle)} /> : null}
                                  <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px")}>
                                    <span style={css("font-size: 14px; line-height: 1.45; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden")}>{sp.text}</span>
                                    <span style={css("font-size: 12px; color: var(--muted-2)")}>{sp.meta}</span>
                                    {sp.hasMetrics ? (
                                      <span style={css("display: flex; flex-wrap: wrap; gap: 4px 14px")}>
                                        {(sp.metrics || []).map((pm, pm__i) => (
                                          <span key={pm__i} style={css(V.lib.social.mStyle)}>
                                            <strong style={css("font-size: 14px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums")}>{pm.value}</strong>
                                            {pm.label}
                                          </span>
                                        ))}
                                      </span>
                                    ) : <span style={css("font-size: 13px; color: var(--muted)")}>{sp.pendingText}</span>}
                                  </span>
                                  <span style={css("flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px")}>
                                    {sp.hasUrl ? (
                                      <a href={sp.url} target="_blank" rel="noopener noreferrer" style={css(V.lib.linkStyle)}>
                                        <span>{sp.openLabel}</span>
                                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                          <path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                        </svg>
                                      </a>
                                    ) : null}
                                    <span style={css("font-size: 11px; color: var(--muted-2)")}>{sp.fresh}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {V.lib.social.more ? <p style={css("margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; color: var(--muted)")}>{V.lib.social.more}{/* app: older posts on demand */}<button type="button" onClick={V.lib.social.loadMore} style={css(V.ui.ghostSm + " border: 1px solid var(--border);")}>Show 100 more</button></p> : null}
                          </section>
                        ) : null}
                        {V.lib.social.empty ? (
                          <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 24px 0")}>
                            <p style={css("margin: 0; flex: 1 1 260px; font-size: var(--text-body-sm); color: var(--muted)")}>{V.lib.social.emptyText}</p>
                            {V.lib.social.canConnect ? <button type="button" onClick={V.lib.social.goConnect} style={css(V.ui.btnGhost)}>Open Integrations</button> : null}
                          </div>
                        ) : null}
                        {V.lib.social.gap ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.lib.social.gap}</p> : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {" "}
                {V.pg.isBrand ? (
                  <>
                    {/* app: empty state before any brand exists */}
                    {V.br.isEmpty ? (
                      <section aria-labelledby="br-empty" style={css("display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 56px 24px; border: 1px dashed var(--border-strong); border-radius: 16px; background: var(--surface); text-align: center")}>
                        <span aria-hidden="true" style={css("width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-3)")}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.5a1.5 1.5 0 0 0-1 2.6c.6.6.5 1.6-.2 2.2-.6.5-1.4.9-2.3 1.2z"></path>
                            <circle cx="7.5" cy="10.5" r="1"></circle><circle cx="12" cy="7.5" r="1"></circle><circle cx="16.5" cy="10.5" r="1"></circle>
                          </svg>
                        </span>
                        <h2 id="br-empty" style={css(V.ui.h2)}>{V.br.emptyTitle}</h2>
                        <p style={css("margin: 0; max-width: 460px; font-size: 14px; line-height: 1.5; color: var(--muted)")}>{V.br.emptyText}</p>
                        {V.br.canAdd ? (
                          <button type="button" onClick={V.br.add} style={css(V.ui.btnPrimary + " margin-top: 4px")}>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                              <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                            </svg>
                            New brand
                          </button>
                        ) : null}
                      </section>
                    ) : (
                    <div style={css("display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start")}>
                      {V.br.hasPicker ? (
                        <>
                          <nav aria-label="Brands" style={css("flex: 0 0 240px; max-width: 100%; display: flex; flex-direction: column; gap: 18px")}>
                            {(V.br.groups || []).map((bg, bg__i) => (
                              <Fragment key={bg__i}>
                                <div role="group" aria-label={bg.title} style={css("display: flex; flex-direction: column; gap: 2px")}>
                                  <p style={css("margin: 0; padding: 0 12px 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-2)")}>{bg.title}</p>
                                  {" "}
                                  {(bg.items || []).map((bi, bi__i) => (
                                    <Fragment key={bi__i}>
                                      <button type="button" className="fb-ni" aria-current={bi.current} onClick={bi.pick} style={css(bi.style)}>
                                        <span aria-hidden="true" style={css(bi.tile)}>{bi.initials}</span>
                                        {" "}
                                        <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                          <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{bi.name}</span>
                                          {" "}
                                          <span style={css("font-size: 12px; font-weight: 400; color: var(--muted)")}>{bi.sub}</span>
                                        </span>
                                      </button>
                                    </Fragment>
                                  ))}
                                </div>
                              </Fragment>
                            ))}
                          </nav>
                        </>
                      ) : null}
                      {" "}
                      <div style={css("flex: 1 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px")}>
                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                          <span aria-hidden="true" style={css(V.br.tileLg)}>{V.br.initials}</span>
                          {" "}
                          <div style={css("flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                            <h2 style={css(V.ui.h2)}>{V.br.name}</h2>
                            {" "}
                            <span style={css("font-size: 13px; color: var(--muted)")}>{V.br.sub}</span>
                          </div>
                          {" "}
                          <span style={css(V.br.kindStyle)}>{V.br.kind}</span>
                          {" "}
                          {V.br.readOnly ? (
                            <>
                              <span style={css(V.br.tagStyle)}>Read only</span>
                            </>
                          ) : null}
                        </div>
                        {" "}
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 16px; align-items: start")}>
                          <section aria-labelledby="br-logo" style={css(V.ui.panel)}>
                            <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                              <h3 id="br-logo" style={css(V.ui.h3)}>Logos</h3>
                              {V.br.canEdit ? (
                                <button type="button" className="fb-ni" onClick={V.br.uploadLogo} style={css(V.ui.ghostSm)}>Upload</button>
                              ) : null}
                            </div>
                            {" "}
                            <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr)); gap: 8px")}>
                              {(V.br.logos || []).map((lo, lo__i) => (
                                <Fragment key={lo__i}>
                                  <div style={css("display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px; overflow: hidden")}>
                                    <button type="button" className="fb-ni" aria-label={lo.aria} onClick={lo.open} style={css("display: flex; align-items: center; justify-content: center; height: 96px; padding: 12px; border: 0; cursor: pointer; background: repeating-conic-gradient(var(--chip) 0% 25%, var(--surface) 0% 50%) 50% / 16px 16px")}>
                                      {lo.hasUrl ? (
                                        <img src={lo.url} alt="" style={css("max-width: 100%; max-height: 100%; object-fit: contain")} />
                                      ) : (
                                        <span style={css("font-size: 12px; font-weight: 600; color: var(--muted)")}>Preview unavailable</span>
                                      )}
                                    </button>
                                    <div style={css("display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 10px; border-top: 1px solid var(--line)")}>
                                      <span style={css("flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{lo.name}</span>
                                      {lo.canRemove ? (
                                        <button type="button" className="fb-ni" aria-label={lo.removeAria} onClick={lo.remove} style={css(V.ui.iconBtn + " width: 28px; height: 28px; min-height: 28px")}>
                                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                            {" "}
                            {V.br.logoNote ? (
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.logoNote}</p>
                            ) : null}
                          </section>
                          {" "}
                          <section aria-labelledby="br-type" style={css(V.ui.panel)}>
                            <h3 id="br-type" style={css(V.ui.h3)}>Typography</h3>
                            {/* app: empty state when the brand has nothing saved */}
                            {V.br.fontsNote ? (
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.fontsNote}</p>
                            ) : null}
                            {" "}
                            {(V.br.fonts || []).map((fo, fo__i) => (
                              <Fragment key={fo__i}>
                                <div style={css("display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line)")}>
                                  <span aria-hidden="true" style={css(fo.sampleStyle)}>Aa</span>
                                  {" "}
                                  <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                    <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{fo.name}</span>
                                    <span style={css("font-size: 12px; color: var(--muted-2)")}>{fo.use}</span>
                                  </span>
                                </div>
                              </Fragment>
                            ))}
                          </section>
                        </div>
                        {" "}
                        <section aria-labelledby="br-color" style={css(V.ui.panel)}>
                          <h3 id="br-color" style={css(V.ui.h3)}>Colors</h3>
                          {/* app: empty state when the brand has nothing saved */}
                          {V.br.colorsNote ? (
                            <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.colorsNote}</p>
                          ) : null}
                          {" "}
                          <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)); gap: 10px")}>
                            {(V.br.colors || []).map((co, co__i) => (
                              <Fragment key={co__i}>
                                <div style={css("display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 14px; overflow: hidden")}>
                                  <span aria-hidden="true" style={css(co.swatch)}></span>
                                  {" "}
                                  <div style={css("display: flex; align-items: center; gap: 8px; padding: 10px 6px 10px 12px")}>
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 13px; font-weight: 600; color: var(--ink)")}>{co.name}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2); font-variant-numeric: tabular-nums; letter-spacing: 0.02em")}>{co.hex}</span>
                                    </span>
                                    {" "}
                                    <button type="button" className="fb-ni" aria-label={co.aria} onClick={co.copy} style={css(V.ui.ghostSm)}>{co.btn}</button>
                                  </div>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </section>
                        {" "}
                        <section aria-labelledby="br-social" style={css(V.ui.panel)}>
                          <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                            <h3 id="br-social" style={css(V.ui.h3)}>Social links</h3>
                            {V.br.canEdit && V.br.hasSocials ? (
                              <button type="button" className="fb-ni" onClick={V.br.openEdit} style={css(V.ui.ghostSm)}>Edit links</button>
                            ) : null}
                          </div>
                          {/* app: empty state when the brand has no links saved */}
                          {!V.br.hasSocials ? (
                            <div style={css("display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 12px; text-align: center")}>
                              <p style={css("margin: 0; font-size: 15px; font-weight: 600; color: var(--ink)")}>No social links added</p>
                              <p style={css("margin: 0; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--muted)")}>{V.br.socialsNote}</p>
                              {V.br.canEdit ? (
                                <button type="button" onClick={V.br.openEdit} style={css(V.ui.btnPrimary + " margin-top: 4px;")}>Add links</button>
                              ) : null}
                            </div>
                          ) : (
                            <div style={css("display: flex; flex-direction: column; margin: 0 -20px -20px; border-top: 1px solid var(--line)")}>
                              {(V.br.socials || []).map((so, so__i) => (
                                <Fragment key={so__i}>
                                  <div className="row" style={css("display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 12px 8px 20px; border-bottom: 1px solid var(--line); box-sizing: border-box")}>
                                    <span aria-hidden="true" style={css("width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-2); font-size: 14px; font-weight: 700")}>{so.initial}</span>
                                    {" "}
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{so.name}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{so.handle}</span>
                                    </span>
                                    {" "}
                                    <button type="button" className="fb-ni" aria-label={so.copyAria} onClick={so.copy} style={css(V.ui.ghostSm)}>{so.btn}</button>
                                    <a href={so.url} target="_blank" rel="noopener noreferrer" aria-label={so.openAria} style={css(V.ui.ghostSm + " text-decoration: none; display: inline-flex; align-items: center;")}>Open</a>
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          )}
                        </section>
                        {" "}
                        {V.br.rulesNote ? (
                          <section aria-labelledby="br-voice" style={css(V.ui.panel)}>
                            <h3 id="br-voice" style={css(V.ui.h3)}>Voice and rules</h3>
                            <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.rulesNote}</p>
                          </section>
                        ) : null}
                        {" "}
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; align-items: start")}>
                          {(V.br.rules || []).map((rl, rl__i) => (
                            <Fragment key={rl__i}>
                              <section style={css(V.ui.panel)}>
                                <h3 style={css(V.ui.h3)}>{rl.title}</h3>
                                {" "}
                                {rl.hasTags ? (
                                  <>
                                    <div style={css("display: flex; flex-wrap: wrap; gap: 6px")}>
                                      {(rl.tags || []).map((rt2, rt2__i) => (
                                        <Fragment key={rt2__i}>
                                          <span style={css(V.br.tagStyle)}>{rt2}</span>
                                        </Fragment>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                                {" "}
                                <ul style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px")}>
                                  {(rl.items || []).map((ri, ri__i) => (
                                    <Fragment key={ri__i}>
                                      <li style={css("display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.5; color: var(--ink-2)")}>
                                        <span aria-hidden="true" style={css(ri.markStyle)}>{ri.mark}</span>
                                        <span>{ri.text}</span>
                                      </li>
                                    </Fragment>
                                  ))}
                                </ul>
                              </section>
                            </Fragment>
                          ))}
                        </div>
                        {" "}
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 16px; align-items: start")}>
                          <section aria-labelledby="br-refs" style={css(V.ui.panel)}>
                            <h3 id="br-refs" style={css(V.ui.h3)}>References</h3>
                            {/* app: empty state when the brand has nothing saved */}
                            {V.br.refsNote ? (
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.refsNote}</p>
                            ) : null}
                            {" "}
                            <div style={css("display: flex; flex-direction: column; margin: 0 -20px -20px; border-top: 1px solid var(--line)")}>
                              {(V.br.refs || []).map((rf2, rf2__i) => (
                                <Fragment key={rf2__i}>
                                  <div style={css("display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px 6px 20px; border-bottom: 1px solid var(--line); box-sizing: border-box")}>
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{rf2.name}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2)")}>{rf2.meta}</span>
                                    </span>
                                    {" "}
                                    {rf2.isProject ? (
                                      <>
                                        <button type="button" className="fb-ni" aria-label={rf2.aria} onClick={rf2.open} style={css(V.ui.ghostSm)}>Open</button>
                                      </>
                                    ) : null}
                                    {" "}
                                    {rf2.isLink ? (
                                      <>
                                        <a href="#" aria-label={rf2.aria} style={css(V.lib.linkStyle)}>View</a>
                                      </>
                                    ) : null}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </section>
                          {" "}
                          <section aria-labelledby="br-assets" style={css(V.ui.panel)}>
                            <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                              <h3 id="br-assets" style={css(V.ui.h3)}>Downloads</h3>
                              {V.br.canEdit ? (
                                <button type="button" className="fb-ni" onClick={V.br.uploadFile} style={css(V.ui.ghostSm)}>Upload</button>
                              ) : null}
                            </div>
                            {/* app: empty state when the brand has nothing saved */}
                            {V.br.assetsNote ? (
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.br.assetsNote}</p>
                            ) : null}
                            {" "}
                            <div style={css("display: flex; flex-direction: column; margin: 0 -20px -20px; border-top: 1px solid var(--line)")}>
                              {(V.br.assets || []).map((ba, ba__i) => (
                                <Fragment key={ba__i}>
                                  <div className="row" style={css("display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 12px 8px 20px; border-bottom: 1px solid var(--line); box-sizing: border-box")}>
                                    <span aria-hidden="true" style={css("width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink-3)")}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"></path>
                                      </svg>
                                    </span>
                                    {" "}
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{ba.name}</span>
                                      <span style={css("font-size: 12px; color: var(--muted-2)")}>{ba.meta}</span>
                                    </span>
                                    {" "}
                                    {ba.canOpen ? (
                                      <button type="button" className="fb-ni" aria-label={ba.aria} onClick={ba.open} style={css(V.ui.ghostSm)}>Download</button>
                                    ) : null}
                                    {ba.canRemove ? (
                                      <button type="button" className="fb-ni" aria-label={ba.removeAria} onClick={ba.remove} style={css(V.ui.iconBtn + " width: 32px; height: 32px; min-height: 32px")}>
                                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                                      </button>
                                    ) : null}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                    )}
                    {" "}
                    {/* app: New brand dialog (Super Admin) */}
                    {V.br.nb.open ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.br.nb.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="br-new-title" style={css(V.ui.dialog)}>
                          <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}>
                            <div>
                              <h2 id="br-new-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>New brand</h2>
                              <p style={css("margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)")}>Add logos, colors, type and voice after it is created.</p>
                            </div>
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.br.nb.close} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                          </div>
                          <div style={css("display: flex; flex-direction: column; gap: 16px")}>
                            <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <label htmlFor="br-new-name" style={css(V.fieldLabel)}>Name</label>
                              <input id="br-new-name" type="text" autoComplete="off" placeholder="Brand or channel name" value={V.br.nb.name} onChange={V.br.nb.onName} style={css(V.fieldInput)} />
                            </div>
                            <div role="radiogroup" aria-label="Brand type" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                              {(V.br.nb.kinds || []).map((k, k__i) => (
                                <button key={k__i} type="button" role="radio" aria-checked={k.on} onClick={k.pick} style={css(k.style)}>
                                  <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{k.label}</span>
                                  <span style={css("font-size: 12px; color: var(--muted-2)")}>{k.desc}</span>
                                </button>
                              ))}
                            </div>
                            {V.br.nb.isSponsor ? (
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="br-new-acct" style={css(V.fieldLabel)}>Sponsor account</label>
                                <select id="br-new-acct" value={V.br.nb.account} onChange={V.br.nb.onAccount} style={css(V.fieldInput)}>
                                  {V.br.nb.accounts.map((o) => (
                                    <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <span style={css("font-size: 12px; line-height: 1.4; color: var(--muted-2)")}>{V.br.nb.accountHelp}</span>
                              </div>
                            ) : null}
                            {V.br.nb.hasErr ? (
                              <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.br.nb.err}</p>
                            ) : null}
                          </div>
                          <div style={css("display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px")}>
                            <button type="button" className="fb-ni" onClick={V.br.nb.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            <button type="button" disabled={V.br.nb.busy} onClick={V.br.nb.create} style={css(V.ui.btnPrimary)}>{V.br.nb.busy ? "Creating…" : "Create brand"}</button>
                          </div>
                        </dialog>
                      </>
                    ) : null}
                    {" "}
                    {/* app: Edit brand dialog (Super Admin) */}
                    {V.br.hasEdit ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.br.edit.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="br-edit-title" style={css(V.ui.dialog + " width: 680px; max-height: calc(100vh - 48px); overflow-y: auto")}>
                          <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}>
                            <h2 id="br-edit-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Edit brand</h2>
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.br.edit.close} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                          </div>
                          <div style={css("display: flex; flex-direction: column; gap: 16px")}>
                            <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 12px")}>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="be-name" style={css(V.fieldLabel)}>Name</label>
                                <input id="be-name" type="text" autoComplete="off" value={V.br.edit.name} onChange={V.br.edit.onName} style={css(V.fieldInput)} />
                              </div>
                              {/* app: link a sponsor brand to its account after creating it with "link later" */}
                              {V.br.edit.canAccount ? (
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="be-account" style={css(V.fieldLabel)}>Sponsor account</label>
                                  <select id="be-account" value={V.br.edit.account} onChange={V.br.edit.onAccount} style={css(V.fieldInput + " cursor: pointer;")}>
                                    {(V.br.edit.accounts || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </div>
                              ) : null}
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="be-color" style={css(V.fieldLabel)}>Accent color</label>
                                <div style={css("display: flex; gap: 8px")}>
                                  <input type="color" aria-label="Pick accent color" value={V.br.edit.colorPick} onChange={V.br.edit.onColor} style={css("width: 44px; height: 44px; flex: none; padding: 2px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); cursor: pointer")} />
                                  <input id="be-color" type="text" autoComplete="off" placeholder="#1A73E8" value={V.br.edit.color} onChange={V.br.edit.onColor} style={css(V.fieldInput)} />
                                </div>
                              </div>
                            </div>
                            <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>The accent color tints this brand&apos;s tile and its idea cards.</p>
                            <div role="group" aria-labelledby="be-colors" style={css("display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <h3 id="be-colors" style={css(V.ui.h3)}>Colors</h3>
                              {(V.br.edit.colors || []).map((r, r__i) => (
                                <div key={r__i} style={css("display: flex; align-items: center; gap: 8px")}>
                                  <input type="color" aria-label={"Pick color " + (r__i + 1)} value={r.pick} onChange={r.onHex} style={css("width: 40px; height: 40px; flex: none; padding: 2px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); cursor: pointer")} />
                                  <input type="text" autoComplete="off" aria-label={"Color " + (r__i + 1) + " name"} placeholder="Name" value={r.name} onChange={r.onName} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
                                  <input type="text" autoComplete="off" aria-label={"Color " + (r__i + 1) + " hex"} placeholder="#000000" value={r.hex} onChange={r.onHex} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)" + "; flex: 0 0 110px")} />
                                  <button type="button" className="fb-ni" aria-label={r.aria} onClick={r.remove} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                                </div>
                              ))}
                              <button type="button" onClick={V.br.edit.addColor} style={css("align-self: flex-start; min-height: 36px; padding: 0 12px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer")}>Add color</button>
                            </div>
                            <div role="group" aria-labelledby="be-fonts" style={css("display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <h3 id="be-fonts" style={css(V.ui.h3)}>Typography</h3>
                              <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>Font name as installed or on Google Fonts, what it is used for, and the weight (400 regular, 700 bold).</p>
                              {(V.br.edit.fonts || []).map((r, r__i) => (
                                <div key={r__i} style={css("display: flex; align-items: center; gap: 8px")}>
                                  <input type="text" autoComplete="off" aria-label={"Font " + (r__i + 1) + " name"} placeholder="Inter" value={r.name} onChange={r.onName} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
                                  <input type="text" autoComplete="off" aria-label={"Font " + (r__i + 1) + " use"} placeholder="Headlines" value={r.use} onChange={r.onUse} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
                                  <input type="text" inputMode="numeric" autoComplete="off" aria-label={"Font " + (r__i + 1) + " weight"} placeholder="400" value={r.weight} onChange={r.onWeight} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)" + "; flex: 0 0 72px")} />
                                  <button type="button" className="fb-ni" aria-label={r.aria} onClick={r.remove} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                                </div>
                              ))}
                              <button type="button" onClick={V.br.edit.addFont} style={css("align-self: flex-start; min-height: 36px; padding: 0 12px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer")}>Add font</button>
                            </div>
                            <div role="group" aria-labelledby="be-voice" style={css("display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <h3 id="be-voice" style={css(V.ui.h3)}>{V.br.edit.voiceLabel}</h3>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="be-tone" style={css(V.fieldLabel)}>Tone words</label>
                                <input id="be-tone" type="text" autoComplete="off" placeholder="Playful, direct, curious" value={V.br.edit.tone} onChange={V.br.edit.onTone} style={css(V.fieldInput)} />
                                <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>Separate with commas.</p>
                              </div>
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px")}>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="be-dos" style={css(V.fieldLabel)}>Do</label>
                                  <textarea id="be-dos" rows="4" placeholder="One per line" value={V.br.edit.dos} onChange={V.br.edit.onDos} style={css(V.ids.textarea)} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="be-donts" style={css(V.fieldLabel)}>Don&apos;t</label>
                                  <textarea id="be-donts" rows="4" placeholder="One per line" value={V.br.edit.donts} onChange={V.br.edit.onDonts} style={css(V.ids.textarea)} />
                                </div>
                              </div>
                            </div>
                            <div role="group" aria-labelledby="be-social" style={css("display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <h3 id="be-social" style={css(V.ui.h3)}>Social links</h3>
                              <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>Paste a profile or channel link. The platform is detected from the link unless you pick one.</p>
                              {(V.br.edit.socials || []).map((r, r__i) => (
                                <div key={r__i} style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                  <select aria-label={"Link " + (r__i + 1) + " platform"} value={r.platform} onChange={r.onPlatform} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink); flex: 0 0 160px; cursor: pointer")}>
                                    {(V.br.edit.socialOpts || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                  <input type="url" inputMode="url" autoComplete="off" aria-label={"Link " + (r__i + 1) + " address"} placeholder="instagram.com/yourbrand" value={r.url} onChange={r.onUrl} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink); flex-basis: 200px")} />
                                  <button type="button" className="fb-ni" aria-label={r.aria} onClick={r.remove} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                                </div>
                              ))}
                              <button type="button" onClick={V.br.edit.addSocial} style={css("align-self: flex-start; min-height: 36px; padding: 0 12px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer")}>Add link</button>
                            </div>
                            <div role="group" aria-labelledby="be-secs" style={css("display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                              <h3 id="be-secs" style={css(V.ui.h3)}>More rules</h3>
                              <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>Extra sections such as sponsor read rules, thumbnail rules or legal lines. One item per line.</p>
                              {(V.br.edit.sections || []).map((r, r__i) => (
                                <div key={r__i} style={css("display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 12px")}>
                                  <div style={css("display: flex; align-items: center; gap: 8px")}>
                                    <input type="text" autoComplete="off" aria-label={"Section " + (r__i + 1) + " title"} placeholder="Section title" value={r.title} onChange={r.onTitle} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
                                    <button type="button" className="fb-ni" aria-label={r.aria} onClick={r.remove} style={css(V.ui.iconBtn)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg></button>
                                  </div>
                                  <textarea rows="3" aria-label={"Section " + (r__i + 1) + " items"} placeholder="One per line" value={r.text} onChange={r.onText} style={css(V.ids.textarea)} />
                                </div>
                              ))}
                              <button type="button" onClick={V.br.edit.addSection} style={css("align-self: flex-start; min-height: 36px; padding: 0 12px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer")}>Add section</button>
                            </div>
                            {V.br.edit.hasErr ? (
                              <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.br.edit.err}</p>
                            ) : null}
                            {V.br.edit.confirm ? (
                              <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.br.edit.delNote}</p>
                            ) : null}
                          </div>
                          <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 24px")}>
                            <button type="button" className="fb-ni" onClick={V.br.edit.del} style={css("min-height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 14px; background: " + (V.br.edit.confirm ? "var(--red-soft)" : "transparent") + "; color: var(--red-ink); font-weight: 600; cursor: pointer")}>{V.br.edit.delLabel}</button>
                            <span style={css("flex: 1")}></span>
                            <button type="button" className="fb-ni" onClick={V.br.edit.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            <button type="button" onClick={V.br.edit.save} style={css(V.ui.btnPrimary)}>Save brand</button>
                          </div>
                        </dialog>
                      </>
                    ) : null}
                  </>
                ) : null}
                {" "}
                {V.pg.isIdeas ? (
                  <>
                    {/* app: research run strip (Super Admin), live through the research_runs realtime subscription */}
                    {V.ids.rs.hasPanel ? (
                      <section aria-label={V.ids.rs.strip.title} aria-live="polite" style={css("display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2)")}>
                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px")}>
                          <span aria-hidden="true" style={css(V.ids.rs.strip.iconStyle)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
                          </span>
                          <div style={css("flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 8px")}>
                            <div style={css("display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px")}>
                              <span style={css("font-size: 14px; font-weight: 600; color: var(--ink)")}>{V.ids.rs.strip.title}</span>
                              <span style={css(V.ids.rs.panel.statusStyle)}>{V.ids.rs.panel.status}</span>
                              <span style={css("font-size: 13px; color: var(--muted)")}>{V.ids.rs.strip.text}</span>
                            </div>
                            {V.ids.rs.strip.active ? (
                              <div role="progressbar" aria-label="Research run progress" aria-valuemin="0" aria-valuemax={V.ids.rs.strip.max} aria-valuenow={V.ids.rs.strip.now} style={css("height: 6px; border-radius: 999px; background: var(--border); overflow: hidden")}><div style={css(V.ids.rs.strip.bar)}></div></div>
                            ) : null}
                          </div>
                          <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                            {V.ids.rs.panel.canShow ? <button type="button" onClick={V.ids.rs.panel.show} style={css(V.ui.btnPrimary)}>Show new ideas</button> : null}
                            <button type="button" className="fb-ni" aria-expanded={V.ids.rs.strip.expanded ? 'true' : 'false'} onClick={V.ids.rs.strip.toggle} style={css("min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer")}>{V.ids.rs.strip.viewLabel}</button>
                            {V.ids.rs.panel.active ? <button type="button" className="fb-ni" onClick={V.ids.rs.panel.cancel} style={css("min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer")}>Cancel</button> : null}
                            {V.ids.rs.panel.canDismiss ? (
                              <button type="button" className="fb-ni" aria-label="Dismiss" onClick={V.ids.rs.panel.dismiss} style={css(V.ui.iconBtn)}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {V.ids.rs.strip.expanded ? (
                          <>
                            <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.ids.rs.panel.topics}  ·  {V.ids.rs.panel.when}</p>
                            <ul style={css("margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 8px")}>
                              {(V.ids.rs.panel.sources || []).map((rsx, rsx__i) => (
                                <li key={rsx__i} style={css("display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); min-width: 0")}>
                                  <span style={css("display: flex; align-items: center; gap: 8px")}>
                                    <span style={css("flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ink)")}>{rsx.label}</span>
                                    <span style={css(rsx.stateStyle)}>{rsx.state}</span>
                                  </span>
                                  <span style={css(rsx.detailStyle)}>{rsx.via}{rsx.detail ? '  ·  ' + rsx.detail : ''}</span>
                                </li>
                              ))}
                            </ul>
                            {V.ids.rs.panel.hasError ? <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.ids.rs.panel.error}</p> : null}
                          </>
                        ) : null}
                      </section>
                    ) : null}
                    {" "}
                    {/* app: smart views, filters, sort and layout (docs/design/ideas-research/Main) */}
                    <div style={css("display: flex; flex-direction: column; gap: 14px")}>
                      <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                      <div role="group" aria-label="Smart views" className="fb-views" style={css("flex: 0 1 auto; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                        {(V.ids.views || []).map((v, v__i) => (
                          <button key={v__i} type="button" aria-pressed={v.pressed} onClick={v.pick} style={css(v.style)}>
                            <span aria-hidden="true" style={css(v.dot)}></span>{v.label}<span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{v.count}</span>
                          </button>
                        ))}
                        {(V.ids.saved || []).map((v, v__i) => (
                          <span key={'s' + v__i} style={css(v.style)}>
                            <button type="button" aria-pressed={v.pressed} onClick={v.pick} style={css("display: inline-flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 8px 0 14px; border: 0; background: transparent; font-size: 14px; font-weight: 500; letter-spacing: normal; color: inherit; cursor: pointer")}>
                              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>{v.label}
                            </button>
                            <button type="button" className="fb-ni" aria-label={v.removeLabel} title={v.removeLabel} onClick={v.remove} style={css("width: 32px; min-height: 38px; padding: 0; border: 0; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
                            </button>
                          </span>
                        ))}
                      </div>
                        <span style={css("position: relative; display: inline-flex" + (V.ids.saveOpen ? "; z-index: 30" : ""))}>
                          <button type="button" className="fb-ni" aria-expanded={V.ids.saveOpen ? 'true' : 'false'} onClick={V.ids.toggleSave} style={css("display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px dashed var(--border-strong); border-radius: 999px; background: transparent; font-size: 14px; font-weight: 500; color: var(--ink-3); cursor: pointer")}>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>Save view
                          </button>
                          {V.ids.saveOpen ? (
                            <>
                              <button type="button" tabIndex="-1" aria-label="Close" onClick={V.ids.toggleSave} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                              <div role="dialog" aria-label="Save this view" style={css("position: absolute; z-index: 1; top: calc(100% + 6px); left: 0; width: 280px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.14)")}>
                                <label htmlFor="iv-name" style={css(V.fieldLabel)}>Name this view</label>
                                <input id="iv-name" type="text" autoComplete="off" autoFocus placeholder="Completeful shorts" value={V.ids.saveName} onChange={V.ids.onSaveName} onKeyDown={V.ids.onSaveKey} style={css(V.fieldInput)} />
                                <p style={css("margin: 0; font-size: 12px; color: var(--muted)")}>Saves the view, filters, sort and layout for you.</p>
                                <button type="button" onClick={V.ids.saveView} disabled={!V.ids.saveName.trim()} style={css(V.ui.btnPrimary + (V.ids.saveName.trim() ? "" : " opacity: 0.5;"))}>Save view</button>
                              </div>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 18px; border-bottom: 1px solid var(--line)")}>
                        <div style={css("flex: 1 1 260px; max-width: 420px; position: relative; display: flex; align-items: center")}>
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={css("position: absolute; left: 14px; color: var(--muted-2)")}><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
                          <label htmlFor="idea-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search ideas</label>
                          <input id="idea-search" type="search" autoComplete="off" placeholder="Search titles, hooks, tags" value={V.ids.q} onChange={V.ids.onSearch} style={css("width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 14px 0 40px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
                        </div>
                        {V.ids.showBrandFilter ? <DD d={V.dd.ideaBrand} id="idea-brand" className="fb-ifilter" /> : null}
                        <DD d={V.dd.ideaType} id="idea-type" className="fb-ifilter" />
                        <DD d={V.dd.ideaFormat} id="idea-format" className="fb-ifilter" />
                        <DD d={V.dd.ideaPillar} id="idea-pillar" className="fb-ifilter" />
                        <span className="fb-ispacer" style={css("flex: 1 1 0; min-width: 0")}></span>
                        <DD d={V.dd.ideaSort} id="idea-sort" className="fb-ifilter" />
                        <div role="group" aria-label="Layout" style={css("display: inline-flex; padding: 3px; gap: 2px; border-radius: 14px; background: var(--chip)")}>
                          {(V.ids.layouts || []).map((l, l__i) => (
                            <button key={l__i} type="button" aria-pressed={l.pressed} aria-label={l.label} title={l.label} onClick={l.pick} style={css(l.style)}>
                              {l.isGallery ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="4" width="8" height="7" rx="1.5"></rect><rect x="13" y="4" width="8" height="7" rx="1.5"></rect><rect x="3" y="13" width="8" height="7" rx="1.5"></rect><rect x="13" y="13" width="8" height="7" rx="1.5"></rect></svg> : null}
                              {l.isBoard ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"></rect><rect x="10" y="4" width="5" height="11" rx="1.5"></rect><rect x="17" y="4" width="4" height="7" rx="1.5"></rect></svg> : null}
                              {l.isList ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"></path></svg> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {" "}
                    {V.ids.noIdeas ? (
                      <p style={css("margin: 0; padding: 24px 0; font-size: var(--text-body-sm); color: var(--muted)")}>{V.ids.emptyText}</p>
                    ) : (
                      <p aria-live="polite" style={css("margin: -8px 0 0; font-size: 13px; color: var(--muted)")}>
                        {V.ids.summary}
                        {/* app: Show ideas from a research run filters to that run until cleared */}
                        {V.ids.hasRun ? <>{" "}<button type="button" onClick={V.ids.clearRun} style={css("padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: underline; cursor: pointer")}>Show all ideas</button></> : null}
                      </p>
                    )}
                    {" "}
                    {V.ids.isGallery ? (
                      <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 32px 24px")}>
                        {(V.ids.cards || []).map((ic2, ic2__i) => (
                          <button key={ic2__i} type="button" className="fb-yt" onClick={ic2.open} aria-label={ic2.aria} style={css("display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: 0; border: 0; background: transparent; text-align: left; color: inherit; cursor: pointer; letter-spacing: normal; line-height: 1.3; font-weight: 400")}>
                            <span className="fb-yt-thumb" style={css(ic2.thumbStyle)}>
                              <span style={css("position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; gap: 6px")}>
                                <span style={css(ic2.priStyle)}>{ic2.pri}</span>
                                {ic2.fromResearch ? <span style={css("display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 7px; background: rgba(255,255,255,0.92); color: #111111; font-size: 11px; font-weight: 700")}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>Research</span> : null}
                              </span>
                              <Hook b={ic2} />
                              <span style={css("position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 8px; background: rgba(17,17,17,0.76); color: #FFFFFF; font-family: var(--font-main); font-size: 12px; font-weight: 600; white-space: nowrap")}>{ic2.badge}</span>
                            </span>
                            <span style={css("display: flex; align-items: flex-start; gap: 12px")}>
                              <span aria-hidden="true" style={css(ic2.avatarStyle)}>{ic2.initials}</span>
                              <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                                <span style={css(ic2.titleStyle)}>{ic2.title}</span>
                                <span style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--muted)")}>
                                  <span style={css("display: inline-flex; align-items: center; gap: 6px; color: var(--ink-3)")}><span aria-hidden="true" style={css(ic2.dot)}></span>{ic2.status}</span>
                                  <span>{ic2.brand}</span>
                                  {ic2.format ? <span>{ic2.format}</span> : null}
                                </span>
                              </span>
                              <span style={css(ic2.scoreStyle)} title="ICE score"><span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}>ICE score </span>{ic2.score}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {V.ids.isBoard ? (
                      <div style={css("display: flex; flex-direction: column; gap: 16px")}>
                        <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; align-items: start")}>
                          {(V.ids.cols || []).map((col, col__i) => (
                            <section key={col__i} aria-label={col.label} onDragOver={col.over} onDrop={col.drop} style={css(col.style)}>
                              <div style={css("display: flex; align-items: center; gap: 8px; padding: 4px 4px 8px")}>
                                <span aria-hidden="true" style={css(col.dot)}></span>
                                <h2 style={css("margin: 0; font-size: 14px; font-weight: 700; color: var(--ink)")}>{col.label}</h2>
                                <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{col.count}</span>
                                <span style={css("flex: 1")}></span>
                                {col.canAdd ? (
                                  <button type="button" className="fb-ni" aria-label={col.addLabel} onClick={V.ids.addDraft} style={css("width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); cursor: pointer")}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>
                                  </button>
                                ) : null}
                              </div>
                              {(col.items || []).map((b, b__i) => (
                                <article key={b__i} className="fb-bcard" draggable={b.canDrag} onDragStart={b.dragStart} onDragEnd={V.ids.dragEnd} style={css(b.style)}>
                                  <div style={css(b.thumbStyle)}>
                                    <Hook b={b} />
                                    {b.canDrag === 'true' ? <span aria-hidden="true" style={css("position: absolute; top: 8px; right: 8px; display: inline-flex; padding: 4px; border-radius: 6px; background: rgba(255,255,255,0.88); color: #444444")}><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.3"></circle><circle cx="7.5" cy="2.5" r="1.3"></circle><circle cx="2.5" cy="7" r="1.3"></circle><circle cx="7.5" cy="7" r="1.3"></circle><circle cx="2.5" cy="11.5" r="1.3"></circle><circle cx="7.5" cy="11.5" r="1.3"></circle></svg></span> : null}
                                  </div>
                                  <div style={css("display: flex; flex-direction: column; gap: 8px; padding: 12px 12px 10px")}>
                                    <button type="button" onClick={b.open} style={css("padding: 0; border: 0; background: transparent; text-align: left; font-size: 14px; font-weight: 600; line-height: 1.35; letter-spacing: normal; color: var(--ink); cursor: pointer")}>{b.title}</button>
                                    <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 6px")}>
                                      <span style={css(b.typeStyle)}>{b.type}</span>
                                      <span style={css("font-size: 12px; color: var(--muted)")}>{b.brand}</span>
                                      {b.format ? <span style={css("font-size: 12px; color: var(--muted)")}>{b.format}</span> : null}
                                    </div>
                                    <div style={css("display: flex; align-items: center; gap: 8px; padding-top: 4px")}>
                                      <span style={css(b.scoreStyle)} title="ICE score">{b.score}</span>
                                      <span style={css("display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted)")}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"></path></svg>{b.comments}<span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}> comments</span></span>
                                      <span style={css("flex: 1")}></span>
                                      <span role="img" aria-label={b.ownerLabel} title={b.ownerLabel} style={css("width: 26px; height: 26px; border-radius: 999px; background: var(--chip-2); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--ink-3)")}>{b.ownerIni}</span>
                                      {b.canMove ? (
                                        <button type="button" className="fb-ni" aria-label={b.moveLabel} title={b.moveLabel} onClick={b.move} style={css("width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--ink-3); cursor: pointer")}>
                                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </article>
                              ))}
                              {col.empty ? <p style={css("margin: 0; padding: 28px 12px; border: 1px dashed var(--border-2); border-radius: 14px; text-align: center; font-size: 13px; color: var(--muted)")}>Drop ideas here</p> : null}
                            </section>
                          ))}
                        </div>
                        <div onDragOver={V.ids.archOver} onDrop={V.ids.archDrop} style={css(V.ids.archStyle)}>
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"></rect><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"></path></svg>
                          Drag an idea here to archive it. History is kept.
                        </div>
                      </div>
                    ) : null}
                    {V.ids.isList ? (
                      <div style={css("position: relative; overflow-x: auto; border: 1px solid var(--border); border-radius: 16px")}>
                        <table style={css("width: 100%; min-width: 860px; border-collapse: collapse; font-size: 14px; color: var(--ink)")}>
                          <thead>
                            <tr style={css("background: var(--surface-2); text-align: left")}>
                              {['Idea', 'Brand', 'Type', 'Status', 'Format', 'ICE', 'Owner', 'Updated'].map((h) => (
                                <th key={h} scope="col" style={css("padding: 12px 16px; font-size: 12px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line); white-space: nowrap")}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(V.ids.cards || []).map((r, r__i) => (
                              <tr key={r__i} className="fb-row">
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line)")}>
                                  <button type="button" onClick={r.open} aria-label={r.aria} style={css("display: flex; align-items: center; gap: 12px; padding: 0; border: 0; background: transparent; text-align: left; letter-spacing: normal; color: var(--ink); cursor: pointer")}>
                                    <span aria-hidden="true" style={css(r.miniThumb)}></span><span style={css("font-weight: 600; line-height: 1.35")}>{r.title}</span>
                                  </button>
                                </td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line); color: var(--ink-3); white-space: nowrap")}>{r.brand}</td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line)")}><span style={css(r.typeStyle)}>{r.type}</span></td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line); white-space: nowrap")}><span style={css("display: inline-flex; align-items: center; gap: 6px")}><span aria-hidden="true" style={css(r.dot)}></span>{r.status}</span></td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line); color: var(--ink-3); white-space: nowrap")}>{r.format || '–'}</td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line)")}><span style={css(r.smallScoreStyle)}>{r.score}</span></td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line); color: var(--ink-3); white-space: nowrap")}>{r.owner}</td>
                                <td style={css("padding: 10px 16px; border-bottom: 1px solid var(--line); color: var(--muted); white-space: nowrap")}>{r.updated}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {V.ids.isEmpty ? (
                      <div style={css("display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 16px; border: 1px dashed var(--border-2); border-radius: 20px; text-align: center")}>
                        <p style={css("margin: 0; font-size: 16px; font-weight: 600; color: var(--ink)")}>Nothing in this view</p>
                        <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>Clear the search and filters, or pick another view.</p>
                        <button type="button" className="fb-ni" onClick={V.ids.reset} style={css(V.ui.btnGhost)}>Show all active</button>
                      </div>
                    ) : null}
                    {V.ids.hasToast ? (
                      <div role="status" style={css("position: fixed; z-index: 81; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: calc(100vw - 32px); box-sizing: border-box; display: flex; align-items: center; gap: 14px; padding: 10px 10px 10px 16px; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.24)")}>
                        <span style={css("min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{V.ids.toast}</span>
                        <button type="button" onClick={V.ids.undo} style={css("flex: none; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--inv-faint); color: var(--inv); font-size: 13px; font-weight: 700; cursor: pointer")}>Undo</button>
                      </div>
                    ) : null}
                    {" "}
                    {/* app: idea detail (docs/design/ideas-research/IdeaDetail) */}
                    {V.ids.hasSel ? (
                      <>
                        <button type="button" aria-label="Close idea" onClick={V.ids.closeIdea} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.45); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="idea-title" style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 1120px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--ink); font-family: var(--font-main)")}>
                          <div style={css(V.ids.sel.bannerStyle)}>
                            <div style={css("position: absolute; top: 16px; left: 16px; right: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                              <span style={css(V.ids.sel.priStyle)}>{V.ids.sel.pri}</span>
                              <span style={css("flex: 1")}></span>
                              {V.ids.sel.canCover ? (
                                <button type="button" onClick={V.ids.sel.changeCover} style={css("display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: #FFFFFF; color: #111111; font-size: 13px; font-weight: 600; cursor: pointer")}>
                                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M21 17l-5-5-9 8"></path></svg>Change cover
                                </button>
                              ) : null}
                              <button type="button" aria-label="Close" onClick={V.ids.closeIdea} style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 12px; background: #FFFFFF; color: #111111; cursor: pointer")}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
                              </button>
                            </div>
                            <Hook b={V.ids.sel} />
                          </div>
                          <div style={css("padding: 24px clamp(16px, 4vw, 32px) 20px; display: flex; flex-direction: column; gap: 16px; border-bottom: 1px solid var(--line)")}>
                            <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                              <span aria-hidden="true" style={css(V.ids.sel.brandTile)}>{V.ids.sel.brandInitials}</span>
                              <span style={css("font-size: 14px; font-weight: 600; margin-right: 4px")}>{V.ids.sel.brand}</span>
                              <span style={css(V.ids.sel.typeStyle)}>{V.ids.sel.type}</span>
                              <span style={css(V.ids.sel.statusStyle)}>{V.ids.sel.status}</span>
                              {(V.ids.sel.meta || []).map((m) => <span key={m} style={css(V.ids.sel.metaStyle)}>{m}</span>)}
                            </div>
                            <div style={css("display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px")}>
                              <div style={css("flex: 1 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                                <h2 id="idea-title" style={css("margin: 0; font-family: var(--font-title); font-weight: 900; font-size: clamp(22px, 3vw, 30px); line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance")}>{V.ids.sel.title}</h2>
                                <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>{V.ids.sel.byline}</p>
                              </div>
                              <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                {(V.ids.sel.actions || []).map((ac, ac__i) => (
                                  <button key={ac__i} type="button" className="fb-ni" onClick={ac.pick} style={css(ac.style)}><IdeaIcon name={ac.icon} />{ac.label}</button>
                                ))}
                              </div>
                            </div>
                            {V.ids.sel.showStepper ? (
                              <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 14px; border-radius: 18px; background: var(--surface-2); border: 1px solid var(--border)")}>
                                <ol aria-label="Status" style={css("flex: 999 1 420px; min-width: 0; margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px")}>
                                  {(V.ids.sel.steps || []).map((st, st__i) => (
                                    <li key={st__i} aria-current={st.current} style={css(st.style)}><span aria-hidden="true" style={css(st.dotStyle)}>{st.num}</span><span style={css(st.labelStyle)}>{st.label}</span></li>
                                  ))}
                                </ol>
                                {V.ids.sel.hasCta || V.ids.sel.hasBack ? (
                                  <div style={css("flex: 1 1 auto; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px")}>
                                    {V.ids.sel.hasBack ? <button type="button" className="fb-ni" onClick={V.ids.sel.back} style={css("min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer")}>{V.ids.sel.backLabel}</button> : null}
                                    {V.ids.sel.hasCta ? (
                                      <button type="button" onClick={V.ids.sel.advance} style={css("display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); font-size: 14px; font-weight: 600; cursor: pointer")}>
                                        {V.ids.sel.cta}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {V.ids.sel.hasNote ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.ids.sel.note}</p> : null}
                          </div>
                          <div style={css("display: flex; flex-wrap: wrap; align-items: stretch")}>
                            <div style={css("flex: 999 1 520px; min-width: 0; box-sizing: border-box; padding: 8px clamp(16px, 4vw, 32px) 32px; display: flex; flex-direction: column; gap: 24px; border-right: 1px solid var(--line)")}>
                              <div role="tablist" aria-label="Idea sections" onKeyDown={V.ids.sel.onTabKey} style={css("display: flex; gap: 4px; border-bottom: 1px solid var(--line); overflow-x: auto; overflow-y: hidden")}>
                                {(V.ids.sel.tabs || []).map((t, t__i) => (
                                  <button key={t__i} id={t.id} type="button" role="tab" aria-selected={t.selected} aria-controls={t.panel} tabIndex={t.tabIndex} onClick={t.pick} style={css(t.style)}>{t.label}{t.count ? <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2)")}>{t.count}</span> : null}</button>
                                ))}
                              </div>
                              {V.ids.sel.isOverview ? (
                                <div role="tabpanel" id="idp-overview" aria-labelledby="idt-overview" style={css("display: flex; flex-direction: column; gap: 24px")}>
                                  <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px")}>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border)")}>
                                      <span style={css("font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted)")}>Who it is for</span>
                                      <span style={css(V.ids.sel.audStyle)}>{V.ids.sel.audience}</span>
                                    </div>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border)")}>
                                      <span style={css("font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted)")}>Viewer walks away with</span>
                                      <span style={css(V.ids.sel.promStyle)}>{V.ids.sel.promise}</span>
                                    </div>
                                  </div>
                                  {V.ids.sel.noBody ? (
                                    <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>No description yet.</p>
                                  ) : (
                                    <div style={css("display: flex; flex-direction: column; gap: 12px; font-size: 15px; line-height: 1.6; color: var(--ink-2); max-width: 68ch")}>
                                      {(V.ids.sel.paras || []).map((pa, pa__i) => <p key={pa__i} style={css("margin: 0; white-space: pre-line; overflow-wrap: anywhere")}>{pa}</p>)}
                                    </div>
                                  )}
                                  {(V.ids.sel.tags || []).length ? (
                                    <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                      {(V.ids.sel.tags || []).map((t) => <span key={t} style={css("display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; background: var(--chip); font-size: 13px; color: var(--ink-3)")}>{t}</span>)}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {V.ids.sel.isScript ? (
                                <div role="tabpanel" id="idp-script" aria-labelledby="idt-script" style={css("display: flex; flex-direction: column")}>
                                  {V.ids.sel.noBeats ? <p style={css("margin: 0; padding: 12px 0; font-size: 14px; color: var(--muted)")}>No script yet. Add one in Edit: one paragraph per beat, like “0:20 The problem: what it costs”.</p> : null}
                                  {(V.ids.sel.beats || []).map((bt, bt__i) => (
                                    <div key={bt__i} style={css("display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line)")}>
                                      <span style={css("font-size: 13px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums")}>{bt.time || '–'}</span>
                                      <div style={css("display: flex; flex-direction: column; gap: 4px; min-width: 0")}><span style={css("font-size: 14px; font-weight: 700")}>{bt.label}</span><span style={css("font-size: 14px; line-height: 1.55; color: var(--ink-3); white-space: pre-line; overflow-wrap: anywhere")}>{bt.text}</span></div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {V.ids.sel.isRefs ? (
                                <div role="tabpanel" id="idp-refs" aria-labelledby="idt-refs" style={css("display: flex; flex-direction: column; gap: 10px")}>
                                  {V.ids.sel.noRefs ? <p style={css("margin: 0; padding: 12px 0; font-size: 14px; color: var(--muted)")}>No references yet.</p> : null}
                                  {(V.ids.sel.refs || []).map((r, r__i) => {
                                    const inner = (
                                      <>
                                        <span aria-hidden="true" style={css(r.thumb)}>{r.thumbText}</span>
                                        <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px")}><span style={css("font-size: 14px; font-weight: 600; overflow-wrap: anywhere")}>{r.title}</span><span style={css("font-size: 12px; color: var(--muted)")}>{r.meta}</span></span>
                                        {r.isLink ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none; color: var(--muted)")}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg> : null}
                                      </>
                                    );
                                    const box = "display: flex; align-items: center; gap: 14px; padding: 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2); color: var(--ink); text-decoration: none";
                                    return r.href ? <a key={r__i} className="fb-ref" href={r.href} target="_blank" rel="noopener noreferrer" style={css(box)}>{inner}<span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}> (opens in a new tab)</span></a> : <div key={r__i} style={css(box)}>{inner}</div>;
                                  })}
                                </div>
                              ) : null}
                              {V.ids.sel.isHistory ? (
                                <ol role="tabpanel" id="idp-history" aria-labelledby="idt-history" style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column")}>
                                  {(V.ids.sel.history || []).map((h, h__i) => (
                                    <li key={h__i} style={css("display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 14px")}><span><strong style={css("font-weight: 600")}>{h.who}</strong> {h.text}</span><span style={css("flex: none; font-size: 12px; color: var(--muted)")}>{h.time}</span></li>
                                  ))}
                                </ol>
                              ) : null}
                              <section aria-labelledby="idea-disc" style={css("display: flex; flex-direction: column; gap: 14px; padding-top: 20px; border-top: 1px solid var(--line)")}>
                                <h3 id="idea-disc" style={css("margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 17px")}>Discussion</h3>
                                {V.ids.sel.noComments ? <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>No comments yet.</p> : null}
                                {(V.ids.sel.comments || []).map((cm, cm__i) => (
                                  <div key={cm__i} style={css("display: flex; gap: 12px")}>
                                    <span aria-hidden="true" style={css(cm.avatarStyle)}>{cm.initials}</span>
                                    <div style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px")}>
                                      <span style={css("display: flex; gap: 8px; align-items: baseline")}><span style={css("font-size: 14px; font-weight: 600")}>{cm.who}</span><span style={css("font-size: 12px; color: var(--muted)")}>{cm.time}</span></span>
                                      <p style={css("margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-2); white-space: pre-line; overflow-wrap: anywhere")}>{cm.text}</p>
                                    </div>
                                  </div>
                                ))}
                                {V.ids.sel.canComment ? (
                                  <div style={css("display: flex; gap: 8px; align-items: flex-end")}>
                                    <label htmlFor="idea-comment" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}>Add a comment</label>
                                    <textarea id="idea-comment" rows="2" placeholder="Add a comment. Cmd or Ctrl + Enter to post." value={V.ids.sel.draft} onChange={V.ids.sel.onDraft} onKeyDown={V.ids.sel.onDraftKey} style={css("flex: 1; min-width: 0; box-sizing: border-box; padding: 12px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); font-family: inherit; font-size: 14px; line-height: 1.45; color: var(--ink); resize: vertical")} />
                                    <button type="button" onClick={V.ids.sel.post} style={css(V.ids.sel.postStyle)}>Post</button>
                                  </div>
                                ) : null}
                              </section>
                            </div>
                            <aside aria-label="Properties" style={css("flex: 1 1 300px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 32px; display: flex; flex-direction: column; gap: 20px; background: var(--surface-2); border-radius: 0 0 28px 0")}>
                              <div style={css("display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border)")}>
                                <div style={css("display: flex; align-items: center; justify-content: space-between")}><span style={css("font-size: 13px; font-weight: 600; color: var(--muted)")}>ICE score</span><span style={css(V.ids.sel.scoreTagStyle)}>{V.ids.sel.scoreTag}</span></div>
                                <span style={css("font-family: var(--font-title); font-weight: 900; font-size: 40px; line-height: 1; font-variant-numeric: tabular-nums")}>{V.ids.sel.score}</span>
                                {(V.ids.sel.iceBars || []).map((k) => (
                                  <div key={k.label} style={css("display: grid; grid-template-columns: 84px minmax(0, 1fr) 20px; align-items: center; gap: 10px; font-size: 13px")}>
                                    <span style={css("color: var(--ink-3)")}>{k.label}</span>
                                    <span aria-hidden="true" style={css("height: 6px; border-radius: 999px; background: var(--chip-2); overflow: hidden")}><span style={css(k.bar)}></span></span>
                                    <span style={css("font-weight: 700; text-align: right; font-variant-numeric: tabular-nums")}>{k.value}</span>
                                  </div>
                                ))}
                              </div>
                              <dl style={css("margin: 0; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 12px; font-size: 14px")}>
                                <dt style={css("color: var(--muted)")}>Owner</dt><dd style={css("margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 500")}><span aria-hidden="true" style={css("width: 22px; height: 22px; border-radius: 999px; background: var(--chip-2); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700")}>{V.ids.sel.ownerIni}</span>{V.ids.sel.owner}</dd>
                                <dt style={css("color: var(--muted)")}>Priority</dt><dd style={css("margin: 0")}><span style={css(V.ids.sel.priFlat)}>{V.ids.sel.pri}</span></dd>
                                <dt style={css("color: var(--muted)")}>Effort</dt><dd style={css("margin: 0; font-weight: 500; color: " + (V.ids.sel.effortSet ? "var(--ink)" : "var(--muted)"))}>{V.ids.sel.effort}</dd>
                                <dt style={css("color: var(--muted)")}>Platforms</dt><dd style={css("margin: 0; display: flex; flex-wrap: wrap; gap: 6px")}>{V.ids.sel.noPlatforms ? <span style={css("color: var(--muted)")}>None picked</span> : (V.ids.sel.platforms || []).map((p) => <span key={p} style={css("display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 7px; background: var(--chip-2); font-size: 12px; font-weight: 600")}>{p}</span>)}</dd>
                                <dt style={css("color: var(--muted)")}>Target window</dt><dd style={css("margin: 0; font-weight: 500; color: " + (V.ids.sel.windowSet ? "var(--ink)" : "var(--muted)"))}>{V.ids.sel.window}</dd>
                                <dt style={css("color: var(--muted)")}>Sponsor</dt><dd style={css("margin: 0; font-weight: 500; color: " + (V.ids.sel.sponsorSet ? "var(--ink)" : "var(--muted)"))}>{V.ids.sel.sponsor}</dd>
                                <dt style={css("color: var(--muted)")}>Source</dt><dd style={css("margin: 0; font-weight: 500")}>{V.ids.sel.source}</dd>
                                <dt style={css("color: var(--muted)")}>Project</dt><dd style={css("margin: 0; font-weight: 500; overflow-wrap: anywhere; color: " + (V.ids.sel.projectSet ? "var(--ink)" : "var(--muted)"))}>{V.ids.sel.project}</dd>
                              </dl>
                              <div style={css("display: flex; flex-direction: column; gap: 10px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                                <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><span style={css("font-size: 14px; font-weight: 600")}>Ready to produce</span><span style={css("font-size: 13px; font-weight: 600; color: var(--ink-3); font-variant-numeric: tabular-nums")}>{V.ids.sel.readyLabel}</span></div>
                                <CheckList items={V.ids.sel.ready} />
                              </div>
                            </aside>
                          </div>
                        </dialog>
                      </>
                    ) : null}
                    {" "}
                    {/* app: edit idea (docs/design/ideas-research/IdeaEdit) */}
                    {V.ids.hasEdit ? (
                      <>
                        <button type="button" aria-label="Close without saving" onClick={V.ids.edit.requestClose} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.45); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="ie-h" onKeyDown={V.ids.edit.onKey} style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 1120px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--ink); font-family: var(--font-main)")}>
                          <div onDragOver={V.ids.edit.onDragOver} onDragLeave={V.ids.edit.onDragLeave} onDrop={V.ids.edit.onDrop} style={css(V.ids.edit.bannerStyle)}>
                            <button type="button" aria-label={V.ids.edit.focalLabel} onClick={V.ids.edit.setFocal} onKeyDown={V.ids.edit.onFocalKey} style={css("position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; cursor: inherit")}></button>
                            <span aria-hidden="true" style={css(V.ids.edit.focalStyle)}></span>
                            <Hook b={V.ids.edit} />
                            {V.ids.edit.drag ? (
                              <div aria-hidden="true" style={css("position: absolute; inset: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 2px dashed #FFFFFF; border-radius: 18px; background: rgba(17,17,17,0.55); color: #FFFFFF; font-size: 16px; font-weight: 600; pointer-events: none")}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path></svg>Drop to replace the cover
                              </div>
                            ) : null}
                            <div style={css("position: absolute; top: 16px; left: 16px; right: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; pointer-events: none")}>
                              <span style={css("display: inline-flex; align-items: center; min-height: 32px; padding: 4px 12px; box-sizing: border-box; border-radius: 10px; background: rgba(17,17,17,0.7); color: #FFFFFF; font-size: 12px; font-weight: 600")}>{V.ids.edit.hint}</span>
                              <span style={css("flex: 1")}></span>
                              <button type="button" aria-label="Close without saving" onClick={V.ids.edit.requestClose} style={css("pointer-events: auto; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 12px; background: #FFFFFF; color: #111111; cursor: pointer")}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
                              </button>
                            </div>
                          </div>
                          <div role="toolbar" aria-label="Banner" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; padding: 14px clamp(16px, 4vw, 32px); border-bottom: 1px solid var(--line); background: var(--surface-2)")}>
                            <div style={css("display: flex; align-items: center; gap: 8px")}>
                              <label htmlFor="ie-file" className="fb-ni fb-filelabel" style={css("position: relative; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; cursor: pointer")}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path></svg>{V.ids.edit.hasImg ? 'Replace image' : 'Add image'}
                                <input id="ie-file" type="file" accept="image/*" onChange={V.ids.edit.onFile} style={css("position: absolute; width: 1px; height: 1px; opacity: 0")} />
                              </label>
                              {V.ids.edit.hasImg ? <button type="button" className="fb-ni" onClick={V.ids.edit.removeImg} style={css("min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--red-ink); cursor: pointer")}>Remove</button> : null}
                            </div>
                            <div style={css("display: flex; align-items: center; gap: 8px")}>
                              <span id="ie-cv" style={css("font-size: 13px; color: var(--muted)")}>Style</span>
                              <div role="group" aria-labelledby="ie-cv" style={css("display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip)")}>
                                {(V.ids.edit.covers || []).map((x) => <button key={x.label} type="button" aria-pressed={x.pressed} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                              </div>
                            </div>
                            <div style={css("display: flex; align-items: center; gap: 8px")}>
                              <span id="ie-hl" style={css("font-size: 13px; color: var(--muted)")}>Highlight</span>
                              <div role="group" aria-labelledby="ie-hl" style={css("display: flex; gap: 6px")}>
                                {(V.ids.edit.highlights || []).map((h) => <button key={h.label} type="button" aria-pressed={h.pressed} aria-label={h.label} title={h.label} onClick={h.pick} style={css(h.style)}></button>)}
                              </div>
                            </div>
                            <div style={css("display: flex; align-items: center; gap: 8px")}>
                              <span id="ie-pos" style={css("font-size: 13px; color: var(--muted)")}>Hook position</span>
                              <div role="group" aria-labelledby="ie-pos" style={css("display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip)")}>
                                {(V.ids.edit.positions || []).map((x) => <button key={x.label} type="button" aria-pressed={x.pressed} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                              </div>
                            </div>
                          </div>
                          <div style={css("display: flex; flex-wrap: wrap; align-items: stretch")}>
                            <div style={css("flex: 999 1 520px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 4vw, 32px) 32px; display: flex; flex-direction: column; gap: 20px; border-right: 1px solid var(--line)")}>
                              <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                <span aria-hidden="true" style={css(V.ids.edit.brandTile)}>{V.ids.edit.brandInitials}</span>
                                <span style={css("font-size: 14px; font-weight: 600")}>{V.ids.edit.brand}</span>
                                <span style={css(V.ids.edit.statusStyle)}>{V.ids.edit.status}</span>
                                <h2 id="ie-h" style={css("margin: 0 0 0 auto; font-size: 13px; font-weight: 600; color: var(--muted)")}>Edit idea</h2>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="ie-title" style={css(V.fieldLabel)}>Title</label>
                                <input id="ie-title" className="fb-field" type="text" autoComplete="off" value={V.ids.edit.title} onChange={V.ids.edit.onTitle} style={css("min-height: 52px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-family: var(--font-title); font-weight: 900; font-size: 22px; letter-spacing: -0.02em; color: var(--ink)")} />
                              </div>
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px")}>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><label htmlFor="ie-hook" style={css(V.fieldLabel)}>Banner hook</label><span style={css("font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums")}>{V.ids.edit.hookCount}</span></div>
                                  <input id="ie-hook" type="text" maxLength="24" autoComplete="off" placeholder={V.ids.edit.hookPlaceholder} value={V.ids.edit.hook} onChange={V.ids.edit.onHook} style={css(V.fieldInput)} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ie-type" style={css(V.fieldLabel)}>Type</label><DD d={V.dd.ieType} id="ie-type" /></div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ie-pillar" style={css(V.fieldLabel)}>Content pillar</label><DD d={V.dd.iePillar} id="ie-pillar" /></div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ie-aud" style={css(V.fieldLabel)}>Who it is for</label>
                                  <input id="ie-aud" type="text" autoComplete="off" placeholder="First-time merch sellers" value={V.ids.edit.audience} onChange={V.ids.edit.onAudience} style={css(V.fieldInput)} />
                                </div>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ie-promise" style={css(V.fieldLabel)}>The viewer walks away with</label>
                                  <input id="ie-promise" type="text" autoComplete="off" placeholder="One clear takeaway or payoff" value={V.ids.edit.promise} onChange={V.ids.edit.onPromise} style={css(V.fieldInput)} />
                                </div>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                <label htmlFor="ie-body" style={css(V.fieldLabel)}>Content</label>
                                <textarea id="ie-body" rows="7" aria-describedby="ie-body-h" value={V.ids.edit.body} onChange={V.ids.edit.onBody} style={css(V.ids.textarea + " font-size: 15px; line-height: 1.55;")} />
                                <span id="ie-body-h" style={css("font-size: 12px; color: var(--muted)")}>Blank lines split paragraphs. For the Script tab, start a paragraph with a time and a label, like “0:20 The problem: …”.</span>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                <span id="ie-tags-l" style={css(V.fieldLabel)}>Tags</span>
                                <div role="group" aria-labelledby="ie-tags-l" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 52px; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2)")}>
                                  {(V.ids.edit.tags || []).map((t) => (
                                    <span key={t.label} style={css("display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 4px 0 12px; box-sizing: border-box; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); font-size: 13px")}>{t.label}
                                      <button type="button" aria-label={t.removeLabel} onClick={t.remove} style={css("width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer")}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg></button>
                                    </span>
                                  ))}
                                  <label htmlFor="ie-tag-new" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}>Add a tag</label>
                                  <input id="ie-tag-new" type="text" autoComplete="off" placeholder="Add tag, press Enter" value={V.ids.edit.tagDraft} onChange={V.ids.edit.onTagDraft} onKeyDown={V.ids.edit.onTagKey} style={css("flex: 1 1 140px; min-width: 0; min-height: 36px; padding: 0 6px; border: 0; background: transparent; font-size: 14px; color: var(--ink)")} />
                                </div>
                              </div>
                              <RefList refs={V.ids.edit.refs} add={V.ids.edit.addRef} />
                            </div>
                            <aside aria-label="Properties" style={css("flex: 1 1 300px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 32px; display: flex; flex-direction: column; gap: 18px; background: var(--surface-2)")}>
                              <div style={css("display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border)")}>
                                <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}><span style={css("font-size: 13px; font-weight: 600; color: var(--muted)")}>ICE score</span><span style={css("font-family: var(--font-title); font-weight: 900; font-size: 28px; line-height: 1; font-variant-numeric: tabular-nums")}>{V.ids.edit.iceScore}</span></div>
                                {(V.ids.edit.ice || []).map((k) => (
                                  <div key={k.id} style={css("display: grid; grid-template-columns: 84px minmax(0, 1fr) 22px; align-items: center; gap: 10px")}>
                                    <label htmlFor={k.id} style={css("font-size: 13px; color: var(--ink-3)")}>{k.label}</label>
                                    <input id={k.id} className="fb-range" type="range" min="1" max="10" step="1" value={k.value} onChange={k.onChange} style={css("width: 100%")} />
                                    <span style={css("font-size: 13px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums")}>{k.value}</span>
                                  </div>
                                ))}
                                {V.ids.edit.iceSet ? <button type="button" className="fb-ni" onClick={V.ids.edit.clearIce} style={css("align-self: flex-start; min-height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer")}>Clear score</button> : <p style={css("margin: 0; font-size: 12px; color: var(--muted)")}>Not scored yet. Move a slider to score.</p>}
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ie-owner" style={css(V.fieldLabel)}>Owner</label><DD d={V.dd.ieOwner} id="ie-owner" /></div>
                              <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                <span id="ie-pri-l" style={css(V.fieldLabel)}>Priority</span>
                                <div role="group" aria-labelledby="ie-pri-l" style={css("display: flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip)")}>
                                  {(V.ids.edit.pris || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.label}</button>)}
                                </div>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ie-fmt" style={css(V.fieldLabel)}>Format</label><DD d={V.dd.ieFormat} id="ie-fmt" /></div>
                              <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                <span id="ie-pl-l" style={css(V.fieldLabel)}>Platforms</span>
                                <div role="group" aria-labelledby="ie-pl-l" style={css("display: flex; flex-wrap: wrap; gap: 6px")}>
                                  {(V.ids.edit.platforms || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.on ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg> : null}{p.label}</button>)}
                                </div>
                              </div>
                              <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px")}>
                                <div style={css("display: flex; flex-direction: column; gap: 6px; min-width: 0")}><label htmlFor="ie-eff" style={css(V.fieldLabel)}>Effort</label><DD d={V.dd.ieEffort} id="ie-eff" /></div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px; min-width: 0")}><label htmlFor="ie-win" style={css(V.fieldLabel)}>Window</label><DD d={V.dd.ieWindow} id="ie-win" /></div>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ie-sp" style={css(V.fieldLabel)}>Sponsor fit</label><DD d={V.dd.ieSponsor} id="ie-sp" /></div>
                            </aside>
                          </div>
                          <footer style={css("position: sticky; bottom: 0; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px clamp(16px, 4vw, 32px); border-top: 1px solid var(--line); background: var(--surface)")}>
                            <span role="status" style={css("display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink-3)")}><span aria-hidden="true" style={css(V.ids.edit.dirtyDot)}></span>{V.ids.edit.dirtyLabel}</span>
                            {V.ids.edit.hasErr ? <span role="alert" style={css("font-size: 13px; font-weight: 600; color: var(--red-ink)")}>{V.ids.edit.err}</span> : null}
                            <span style={css("flex: 1")}></span>
                            {V.ids.edit.confirmClose ? (
                              <>
                                <button type="button" className="fb-ni" onClick={V.ids.edit.keepEditing} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; font-size: 14px; font-weight: 500; color: var(--ink-3); cursor: pointer")}>Keep editing</button>
                                <button type="button" onClick={V.ids.edit.discard} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--red-soft); font-size: 14px; font-weight: 600; color: var(--red-ink); cursor: pointer")}>Discard changes</button>
                              </>
                            ) : (
                              <>
                                <span style={css("font-size: 12px; color: var(--muted)")}><kbd style={css("padding: 2px 6px; border: 1px solid var(--border-3); border-radius: 6px; background: var(--surface); font-family: var(--font-main); font-size: 12px")}>⌘ S</kbd> to save</span>
                                <button type="button" className="fb-ni" onClick={V.ids.edit.dirty ? V.ids.edit.requestClose : V.ids.edit.discard} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; font-size: 14px; font-weight: 500; color: var(--ink-3); cursor: pointer")}>{V.ids.edit.dirty ? 'Discard' : 'Close'}</button>
                              </>
                            )}
                            <button type="button" onClick={V.ids.edit.save} aria-disabled={V.ids.edit.dirty ? 'false' : 'true'} style={css(V.ids.edit.saveStyle)}>{V.ids.edit.saveLabel}</button>
                          </footer>
                        </dialog>
                      </>
                    ) : null}
                    {" "}
                    {/* app: new idea (docs/design/ideas-research/NewIdea) */}
                    {V.ids.modal ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.ids.ni.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.45); cursor: default")}></button>
                        <dialog open aria-modal="true" aria-labelledby="ni-h" onKeyDown={V.ids.ni.onKey} style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 1120px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 0; background: var(--surface); border: 1px solid var(--line-4); border-radius: 28px; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--ink); font-family: var(--font-main)")}>
                          <header style={css("display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; padding: 28px clamp(16px, 3vw, 28px) 20px; border-bottom: 1px solid var(--line)")}>
                            <div style={css("flex: 1 1 300px; display: flex; flex-direction: column; gap: 6px; min-width: 0")}>
                              <h2 id="ni-h" style={css("margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 24px; letter-spacing: -0.02em")}>New idea</h2>
                              <p style={css("margin: 0; font-size: 14px; color: var(--muted)")}>Ideas start as Draft and belong to one brand. Capture fast, add the brief when you have it.</p>
                            </div>
                            <div role="group" aria-label="Form depth" style={css("display: inline-flex; padding: 3px; gap: 2px; border-radius: 14px; background: var(--chip)")}>
                              {(V.ids.ni.modes || []).map((m) => <button key={m.label} type="button" aria-pressed={m.pressed} onClick={m.pick} style={css(m.style)}>{m.label}</button>)}
                            </div>
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.ids.ni.close} style={css("width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--ink); cursor: pointer")}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
                            </button>
                          </header>
                          <div style={css("display: flex; flex-wrap: wrap; align-items: flex-start")}>
                            <div style={css("flex: 999 1 520px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 28px; display: flex; flex-direction: column; gap: 28px; border-right: 1px solid var(--line)")}>
                              <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 12px")}>
                                <legend style={css(V.ids.legend)}>Banner</legend>
                                <div role="group" aria-label="Banner style" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                  {(V.ids.ni.covers || []).map((x) => <button key={x.label} type="button" aria-pressed={x.pressed} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                                </div>
                                {V.ids.ni.showDrop ? (
                                  <div onDragOver={V.ids.ni.onDragOver} onDragLeave={V.ids.ni.onDragLeave} onDrop={V.ids.ni.onDrop} style={css(V.ids.ni.dropStyle)}>
                                    <span aria-hidden="true" style={css("width: 48px; height: 48px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--ink)")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path></svg></span>
                                    <p style={css("margin: 0; font-size: 15px; font-weight: 600")}>{V.ids.ni.dropTitle}</p>
                                    <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>JPG, PNG or WebP up to 10 MB. 16:9 works best, 1920×1080 or larger.</p>
                                    <div style={css("position: relative; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px")}>
                                      <label htmlFor="ni-file" className="fb-ni fb-filelabel" style={css("position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; cursor: pointer")}>Browse files<input id="ni-file" type="file" accept="image/*" onChange={V.ids.ni.onFile} style={css("position: absolute; width: 1px; height: 1px; opacity: 0")} /></label>
                                      {V.ids.ni.canPick ? (
                                        <span style={css("position: relative; display: inline-flex" + (V.ids.ni.pickOpen ? "; z-index: 5" : ""))}>
                                          <button type="button" className="fb-ni" aria-expanded={V.ids.ni.pickOpen ? 'true' : 'false'} onClick={V.ids.ni.togglePick} style={css("min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer")}>Pick from brand files</button>
                                          {V.ids.ni.pickOpen ? (
                                            <div role="listbox" aria-label="Brand images" style={css("position: absolute; z-index: 1; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); width: max-content; max-width: 300px; max-height: 240px; overflow-y: auto; box-sizing: border-box; padding: 6px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line-4); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.14); text-align: left")}>
                                              {(V.ids.ni.brandFiles || []).map((f, f__i) => <button key={f__i} type="button" role="option" aria-selected="false" className="mitem" onClick={f.pick} style={css("min-height: 40px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-size: 14px; color: var(--ink); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{f.label}</button>)}
                                            </div>
                                          ) : null}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                                {V.ids.ni.hasImg ? (
                                  <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2)")}>
                                    <span aria-hidden="true" style={css(V.ids.ni.fileThumb)}></span>
                                    <div style={css("flex: 1 1 160px; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                      <span style={css("font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{V.ids.ni.fileName}</span>
                                      <span style={css("font-size: 12px; color: var(--muted)")}>Set the focal point after creating, from Edit.</span>
                                    </div>
                                    <label htmlFor="ni-file2" className="fb-ni fb-filelabel" style={css("position: relative; display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; cursor: pointer")}>Replace<input id="ni-file2" type="file" accept="image/*" onChange={V.ids.ni.onFile} style={css("position: absolute; width: 1px; height: 1px; opacity: 0")} /></label>
                                    <button type="button" className="fb-ni" onClick={V.ids.ni.removeImg} style={css("min-height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 13px; font-weight: 600; color: var(--red-ink); cursor: pointer")}>Remove</button>
                                  </div>
                                ) : null}
                              </fieldset>
                              <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px")}>
                                <legend style={css(V.ids.legend)}>Basics</legend>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ni-title" style={css(V.fieldLabel)}>Title</label>
                                  <input id="ni-title" type="text" autoComplete="off" autoFocus placeholder="What is the idea?" value={V.ids.ni.title} onChange={V.ids.ni.onTitle} style={css(V.fieldInput + " font-size: 15px;")} />
                                </div>
                                <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><label htmlFor="ni-hook" style={css(V.fieldLabel)}>Banner hook</label><span style={css("font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums")}>{V.ids.ni.hookCount}</span></div>
                                  <input id="ni-hook" type="text" maxLength="24" autoComplete="off" placeholder="2 to 4 punchy words" value={V.ids.ni.hook} onChange={V.ids.ni.onHook} style={css(V.fieldInput + " font-size: 15px;")} />
                                </div>
                                {V.ids.ni.showBrand ? <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-brand" style={css(V.fieldLabel)}>Brand</label><DD d={V.dd.niBrand} id="ni-brand" /></div> : null}
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <span id="ni-type-l" style={css(V.fieldLabel)}>Type</span>
                                  <div role="group" aria-labelledby="ni-type-l" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                    {(V.ids.ni.types || []).map((t) => (
                                      <button key={t.label} type="button" aria-pressed={t.pressed} onClick={t.pick} style={css(t.style)}><span aria-hidden="true" style={css(t.sw)}></span><span style={css("display: flex; flex-direction: column; align-items: flex-start; gap: 2px")}><span style={css("font-size: 14px; font-weight: 600")}>{t.label}</span><span style={css("font-size: 12px; color: var(--muted)")}>{t.hint}</span></span></button>
                                    ))}
                                  </div>
                                </div>
                                <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                  <label htmlFor="ni-body" style={css(V.fieldLabel)}>Content</label>
                                  <textarea id="ni-body" rows="5" placeholder="Description, draft script, links and references. Blank lines split paragraphs." value={V.ids.ni.body} onChange={V.ids.ni.onBody} style={css(V.ids.textarea + " font-size: 15px;")} />
                                </div>
                              </fieldset>
                              {V.ids.ni.isFull ? (
                                <>
                                  <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px")}>
                                    <legend style={css(V.ids.legend)}>Angle</legend>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                                      <label htmlFor="ni-aud" style={css(V.fieldLabel)}>Who it is for</label>
                                      <input id="ni-aud" type="text" autoComplete="off" placeholder="First-time merch sellers" value={V.ids.ni.audience} onChange={V.ids.ni.onAudience} style={css(V.fieldInput)} />
                                    </div>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-pillar" style={css(V.fieldLabel)}>Content pillar</label><DD d={V.dd.niPillar} id="ni-pillar" /></div>
                                    <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                      <label htmlFor="ni-promise" style={css(V.fieldLabel)}>The viewer walks away with</label>
                                      <input id="ni-promise" type="text" autoComplete="off" placeholder="One clear takeaway or payoff" value={V.ids.ni.promise} onChange={V.ids.ni.onPromise} style={css(V.fieldInput)} />
                                    </div>
                                    <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px")}>
                                      <span id="ni-fmt-l" style={css(V.fieldLabel)}>Format</span>
                                      <div role="group" aria-labelledby="ni-fmt-l" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                        {(V.ids.ni.formats || []).map((f) => <button key={f.label} type="button" aria-pressed={f.pressed} onClick={f.pick} style={css(f.style)}>{f.label}</button>)}
                                      </div>
                                    </div>
                                    <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px")}>
                                      <span id="ni-pl-l" style={css(V.fieldLabel)}>Platforms <span style={css("font-weight: 400; color: var(--muted)")}>pick any</span></span>
                                      <div role="group" aria-labelledby="ni-pl-l" style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                        {(V.ids.ni.platforms || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.on ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg> : null}{p.label}</button>)}
                                      </div>
                                    </div>
                                  </fieldset>
                                  <fieldset style={css("margin: 0; padding: 20px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface-2); min-width: 0; display: flex; flex-direction: column; gap: 18px")}>
                                    <legend style={css(V.ids.legend + " margin: 0; padding: 0 6px;")}>Score</legend>
                                    <div style={css("display: flex; flex-wrap: wrap; gap: 24px; align-items: center")}>
                                      <div style={css("flex: 999 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 14px")}>
                                        {(V.ids.ni.ice || []).map((k) => (
                                          <div key={k.id} style={css("display: grid; grid-template-columns: 96px minmax(0, 1fr) 32px; align-items: center; gap: 4px 12px")}>
                                            <label htmlFor={k.id} style={css("font-size: 14px; font-weight: 600")}>{k.label}</label>
                                            <input id={k.id} className="fb-range" type="range" min="1" max="10" step="1" value={k.value} onChange={k.onChange} aria-describedby={k.hintId} style={css("width: 100%")} />
                                            <span style={css("font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums")}>{k.value}</span>
                                            <span id={k.hintId} style={css("grid-column: 2 / 4; font-size: 12px; color: var(--muted)")}>{k.hint}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div style={css("flex: 1 1 160px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border)")}>
                                        <span style={css("font-size: 12px; font-weight: 600; color: var(--muted)")}>ICE score</span>
                                        <span style={css("font-family: var(--font-title); font-weight: 900; font-size: 44px; line-height: 1; font-variant-numeric: tabular-nums")}>{V.ids.ni.iceScore}</span>
                                        <span style={css(V.ids.ni.iceTagStyle)}>{V.ids.ni.iceTag}</span>
                                      </div>
                                    </div>
                                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px")}>
                                      <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                        <span id="ni-pri-l" style={css(V.fieldLabel)}>Priority</span>
                                        <div role="group" aria-labelledby="ni-pri-l" style={css("display: inline-flex; align-self: flex-start; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip-2)")}>
                                          {(V.ids.ni.pris || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.label}</button>)}
                                        </div>
                                      </div>
                                      <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                        <span id="ni-eff-l" style={css(V.fieldLabel)}>Production effort</span>
                                        <div role="group" aria-labelledby="ni-eff-l" style={css("display: inline-flex; align-self: flex-start; padding: 3px; gap: 2px; border-radius: 12px; background: var(--chip-2)")}>
                                          {(V.ids.ni.efforts || []).map((p) => <button key={p.label} type="button" aria-pressed={p.pressed} onClick={p.pick} style={css(p.style)}>{p.label}</button>)}
                                        </div>
                                      </div>
                                    </div>
                                  </fieldset>
                                  <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px")}>
                                    <legend style={css(V.ids.legend)}>Planning</legend>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-owner" style={css(V.fieldLabel)}>Owner</label><DD d={V.dd.niOwner} id="ni-owner" /></div>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-win" style={css(V.fieldLabel)}>Target publish window</label><DD d={V.dd.niWindow} id="ni-win" /></div>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-sp" style={css(V.fieldLabel)}>Sponsor fit</label><DD d={V.dd.niSponsor} id="ni-sp" /></div>
                                    <div style={css("grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px")}>
                                      <label htmlFor="ni-tags" style={css(V.fieldLabel)}>Tags</label>
                                      <input id="ni-tags" type="text" autoComplete="off" placeholder="#hooks #shorts" value={V.ids.ni.tags} onChange={V.ids.ni.onTags} style={css(V.fieldInput)} />
                                    </div>
                                  </fieldset>
                                  <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                                    <RefList refs={V.ids.ni.refs} add={V.ids.ni.addRef} legend={V.ids.legend} />
                                    {V.ids.ni.canRun ? <div style={css("display: flex; flex-direction: column; gap: 6px")}><label htmlFor="ni-run" style={css(V.fieldLabel)}>Attach a research run</label><DD d={V.dd.niRun} id="ni-run" /></div> : null}
                                  </div>
                                </>
                              ) : null}
                            </div>
                            <aside aria-label="Preview" style={css("flex: 1 1 320px; min-width: 0; box-sizing: border-box; padding: 24px clamp(16px, 3vw, 28px) 28px; display: flex; flex-direction: column; gap: 20px; position: sticky; top: 0")}>
                              <p style={css("margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted)")}>Preview</p>
                              <div style={css("display: flex; flex-direction: column; gap: 14px")}>
                                <div style={css(V.ids.ni.thumbStyle)}>
                                  <Hook b={V.ids.ni} />
                                  <span style={css("position: absolute; right: 12px; bottom: 12px; display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 8px; background: rgba(17,17,17,0.76); color: #FFFFFF; font-family: var(--font-main); font-size: 12px; font-weight: 600")}>{V.ids.ni.type}  ·  0 comments</span>
                                  <span style={css(V.ids.ni.priStyle)}>{V.ids.ni.pri}</span>
                                </div>
                                <div style={css("display: flex; align-items: flex-start; gap: 12px")}>
                                  <span aria-hidden="true" style={css("width: 40px; height: 40px; flex: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); font-size: 12px; font-weight: 700")}>{V.ids.ni.ini}</span>
                                  <div style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px")}>
                                    <span style={css("font-size: 16px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere")}>{V.ids.ni.previewTitle}</span>
                                    <span style={css("display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 13px; color: var(--muted)")}><span style={css("display: inline-flex; align-items: center; gap: 6px; color: var(--ink-3)")}><span aria-hidden="true" style={css("width: 8px; height: 8px; border-radius: 999px; background: var(--border-strong)")}></span>Draft</span><span>{V.ids.ni.brand}</span>{V.ids.ni.format ? <span>{V.ids.ni.format}</span> : null}</span>
                                  </div>
                                  <span style={css(V.ids.ni.scorePill)}>{V.ids.ni.score}</span>
                                </div>
                              </div>
                              <div style={css("display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border)")}>
                                <div style={css("display: flex; justify-content: space-between; align-items: baseline")}><span style={css("font-size: 14px; font-weight: 600")}>Brief strength</span><span style={css("font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-3)")}>{V.ids.ni.doneLabel}</span></div>
                                <div role="progressbar" aria-label="Brief strength" aria-valuemin="0" aria-valuemax={V.ids.ni.doneMax} aria-valuenow={V.ids.ni.doneN} style={css("height: 6px; border-radius: 999px; background: var(--border); overflow: hidden")}><div style={css(V.ids.ni.doneBar)}></div></div>
                                <CheckList items={V.ids.ni.checks} gap="6px" />
                              </div>
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted); text-wrap: pretty")}>Approvers see score, angle and references on the review card. Missing items stay optional.</p>
                            </aside>
                          </div>
                          <footer style={css("position: sticky; bottom: 0; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px clamp(16px, 3vw, 28px); border-top: 1px solid var(--line); background: var(--surface-2)")}>
                            <label style={css("display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink-3); cursor: pointer")}><input type="checkbox" checked={V.ids.ni.another} onChange={V.ids.ni.onAnother} style={css("width: 18px; height: 18px; accent-color: var(--ink); margin: 0")} />Create another after this one</label>
                            {V.ids.ni.hasErr ? <span role="alert" style={css("font-size: 13px; font-weight: 600; color: var(--red-ink)")}>{V.ids.ni.err}</span> : null}
                            <span style={css("flex: 1")}></span>
                            <span style={css("font-size: 12px; color: var(--muted)")}><kbd style={css("padding: 2px 6px; border: 1px solid var(--border-3); border-radius: 6px; background: var(--surface); font-family: var(--font-main); font-size: 12px")}>⌘ Enter</kbd> to create</span>
                            <button type="button" className="fb-ni" onClick={V.ids.ni.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; font-size: 14px; font-weight: 500; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            <button type="button" onClick={V.ids.ni.create} disabled={V.ids.ni.busy} style={css(V.ui.btnPrimary + (V.ids.ni.busy ? " opacity: 0.6;" : ""))}>{V.ids.ni.createLabel}</button>
                          </footer>
                        </dialog>
                      </>
                    ) : null}
                    {" "}
                    {/* app: research agent dialog (Super Admin) */}
                    {V.ids.rs.open ? (
                      <>
                        <button type="button" aria-label="Close dialog" onClick={V.ids.rs.close} style={css("position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                        {" "}
                        <dialog open aria-modal="true" aria-labelledby="rs-title" style={css(V.ui.dialog + " width: 620px")}>
                          <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px")}>
                            <div>
                              <h2 id="rs-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Research ideas</h2>
                              {" "}
                              <p style={css("margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)")}>Find what is working in a brand&apos;s niche and turn it into Research drafts.</p>
                            </div>
                            {" "}
                            <button type="button" className="fb-ni" aria-label="Close" onClick={V.ids.rs.close} style={css(V.ui.iconBtn)}>
                              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6 6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                          {" "}
                          {/* app: with a model or source disconnected, history stays here and setup is one click away */}
                          {!V.ids.rs.ready ? (
                            <div role="status" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border)")}>
                              <p style={css("flex: 1 1 260px; margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-3)")}>{V.ids.rs.setupText}</p>
                              <button type="button" onClick={V.ids.rs.setup} style={css(V.ui.btnPrimary)}>Set up research</button>
                            </div>
                          ) : null}
                          {V.ids.rs.ready ? (
                          <>
                          <div style={css("display: flex; flex-direction: column; gap: 18px")}>
                            <div role="group" aria-labelledby="rs-brand-l" style={css("display: flex; flex-direction: column; gap: 8px")}>
                              <span id="rs-brand-l" style={css(V.fieldLabel)}>Brand</span>
                              {" "}
                              <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                {(V.ids.rs.brands || []).map((rsb, rsb__i) => (
                                  <Fragment key={rsb__i}>
                                    <button type="button" aria-pressed={rsb.pressed} onClick={rsb.pick} style={css(rsb.style)}>{rsb.label}</button>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <label htmlFor="rs-topics" style={css(V.fieldLabel)}>Niche or seed topics</label>
                              {" "}
                              <textarea id="rs-topics" rows="2" placeholder="home renovation, deck building, power tools" value={V.ids.rs.topics ?? ''} onChange={V.ids.rs.onTopics} style={css(V.ids.textarea)} />
                              {" "}
                              <span style={css("font-size: 12px; color: var(--muted-2)")}>{V.ids.rs.topicsHelp}</span>
                            </div>
                            {" "}
                            <div role="group" aria-labelledby="rs-src-l" style={css("display: flex; flex-direction: column; gap: 8px")}>
                              <span id="rs-src-l" style={css(V.fieldLabel)}>Sources</span>
                              {" "}
                              <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 8px")}>
                                {(V.ids.rs.sources || []).map((rss, rss__i) => (
                                  <Fragment key={rss__i}>
                                    <button type="button" aria-pressed={rss.pressed} aria-disabled={rss.disabled} onClick={rss.pick} style={css(rss.style)}>
                                      <span aria-hidden="true" style={css(rss.tickStyle)}>✓</span>
                                      {" "}
                                      <span style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0")}>
                                        <span style={css("font-size: 14px; font-weight: 600")}>{rss.label}</span>
                                        <span style={css("font-size: 12px; color: var(--muted)")}>{rss.sub}</span>
                                      </span>
                                    </button>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                            {" "}
                            <div role="group" aria-labelledby="rs-count-l" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                              <span id="rs-count-l" style={css(V.fieldLabel + " margin-right: 4px")}>Ideas to draft</span>
                              {" "}
                              {(V.ids.rs.counts || []).map((rsc, rsc__i) => (
                                <Fragment key={rsc__i}>
                                  <button type="button" aria-pressed={rsc.pressed} onClick={rsc.pick} style={css(rsc.style)}>{rsc.label}</button>
                                </Fragment>
                              ))}
                            </div>
                            {" "}
                            <p style={css("margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted-2)")}>{V.ids.rs.note}</p>
                            {" "}
                            {V.ids.rs.hasErr ? (
                              <>
                                <p role="alert" style={css("margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600")}>{V.ids.rs.err}</p>
                              </>
                            ) : null}
                          </div>
                          {" "}
                          <div style={css("display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px")}>
                            <button type="button" className="fb-ni" onClick={V.ids.rs.close} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer")}>Cancel</button>
                            {" "}
                            <button type="button" disabled={V.ids.rs.busy} onClick={V.ids.rs.start} style={css(V.ui.btnPrimary)}>{V.ids.rs.startLabel}</button>
                          </div>
                          </>
                          ) : null}
                          {" "}
                          {V.ids.rs.hasRecent ? (
                            <>
                              <section aria-labelledby="rs-recent" style={css("display: flex; flex-direction: column; gap: 6px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line)")}>
                                <h3 id="rs-recent" style={css(V.ui.h3)}>Recent runs</h3>
                                {" "}
                                <ol style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column")}>
                                  {(V.ids.rs.recent || []).map((rsr, rsr__i) => (
                                    <Fragment key={rsr__i}>
                                      <li style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--ink-3)")}>
                                        <span style={css(rsr.statusStyle)}>{rsr.status}</span>
                                        {" "}
                                        <span style={css("flex: 1; min-width: 160px")}>
                                          <span style={css("font-weight: 600; color: var(--ink)")}>{rsr.brand}</span>
                                          {"  ·  "}{rsr.summary}
                                          <span style={css("display: block; color: var(--muted-2)")}>{rsr.topics}</span>
                                        </span>
                                        {" "}
                                        <span style={css("font-size: 12px; color: var(--muted-2)")}>{rsr.when}</span>
                                        {" "}
                                        {rsr.canShow ? (
                                          <>
                                            <button type="button" onClick={rsr.show} style={css(V.ui.ghostSm)}>Show ideas</button>
                                          </>
                                        ) : null}
                                        {" "}
                                        {rsr.active ? (
                                          <>
                                            <button type="button" onClick={rsr.cancel} style={css(V.ui.ghostSm)}>Cancel</button>
                                          </>
                                        ) : null}
                                        {/* app: run a failed or cancelled run again with the same inputs */}
                                        {rsr.canRetry && V.ids.rs.ready ? <button type="button" disabled={V.ids.rs.busy} onClick={rsr.retry} style={css(V.ui.ghostSm)}>Run again</button> : null}
                                        {rsr.hasError ? <span style={css("flex-basis: 100%; font-size: 12px; color: var(--red-ink)")}>{rsr.error}</span> : null}
                                      </li>
                                    </Fragment>
                                  ))}
                                </ol>
                                {V.ids.rs.hasMoreRuns ? <button type="button" onClick={V.ids.rs.showAllRuns} style={css(V.ui.ghostSm + " align-self: flex-start;")}>Show all runs</button> : null}
                              </section>
                            </>
                          ) : null}
                        </dialog>
                      </>
                    ) : null}
                  </>
                ) : null}
                {" "}
                {V.pg.isSettings ? (
                  <>
                    <div style={css("display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 16px; align-items: start")}>
                      <section aria-labelledby="st-prof" style={css(V.ui.panel)}>
                        <h2 id="st-prof" style={css(V.ui.h3)}>Profile</h2>
                        {" "}
                        <div style={css("display: flex; align-items: center; gap: 14px")}>
                          <span aria-hidden="true" style={css(V.pf.avatarStyle)}>{V.pf.initials}</span>
                          {" "}
                          <span style={css("display: flex; flex-direction: column; gap: 6px")}>
                            <span style={css("font-size: 15px; font-weight: 600; color: var(--ink)")}>{V.pf.name}</span>
                            <span style={css(V.pf.roleStyle)}>{V.pf.roleLabel}</span>
                          </span>
                        </div>
                        {" "}
                        <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                          <label htmlFor="pf-name" style={css(V.fieldLabel)}>Display name</label>
                          {" "}
                          <input id="pf-name" type="text" value={V.pf.name ?? ''} onChange={V.pf.onName} style={css(V.fieldInput)} />
                        </div>
                        {" "}
                        <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                          <label htmlFor="pf-email" style={css(V.fieldLabel)}>Email</label>
                          {" "}
                          <input id="pf-email" type="email" value={V.pf.email ?? ''} onChange={V.pf.onEmail} onBlur={V.pf.onEmailBlur} style={css(V.fieldInput)} />
                        </div>
                        {" "}
                        <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.pf.roleNote}</p>
                      </section>
                      {" "}
                      <section aria-labelledby="st-app" style={css(V.ui.panel)}>
                        <h2 id="st-app" style={css(V.ui.h3)}>Appearance</h2>
                        {" "}
                        {(V.pf.segs || []).map((sg2, sg2__i) => (
                          <Fragment key={sg2__i}>
                            <div role="radiogroup" aria-label={sg2.label} style={css("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px")}>
                              <span style={css("font-size: 14px; color: var(--ink)")}>{sg2.label}</span>
                              {" "}
                              <span style={css("display: flex; gap: 4px; padding: 4px; background: var(--track); border-radius: 14px")}>
                                {(sg2.options || []).map((so2, so2__i) => (
                                  <Fragment key={so2__i}>
                                    <button type="button" role="radio" aria-checked={so2.on} onClick={so2.pick} style={css(so2.style)}>{so2.label}</button>
                                  </Fragment>
                                ))}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                        {" "}
                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px")}>
                          <label htmlFor="pf-view" style={css("font-size: 14px; color: var(--ink)")}>Default board view</label>
                          {" "}
                          <div style={css(V.dd.pfView.wrap)} onKeyDown={V.dd.pfView.onKey}>
                            <button type="button" id="pf-view" aria-haspopup="listbox" aria-expanded={V.dd.pfView.exp} aria-label={V.dd.pfView.aria} onClick={V.dd.pfView.toggle} style={css(V.dd.pfView.btn)}>
                              <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left")}>{V.dd.pfView.value}</span>
                              {" "}
                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(V.dd.pfView.chev)}>
                                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                              </svg>
                            </button>
                            {" "}
                            {V.dd.pfView.open ? (
                              <>
                                <button type="button" tabIndex="-1" aria-label="Close list" onClick={V.dd.pfView.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
                                {" "}
                                <div role="listbox" aria-label={V.dd.pfView.label} style={css(V.dd.pfView.pop)}>
                                  {(V.dd.pfView.items || []).map((ddo, ddo__i) => (
                                    <Fragment key={ddo__i}>
                                      <button type="button" role="option" className="mitem" aria-selected={ddo.sel} onClick={ddo.pick} style={css(ddo.style)}>
                                        <span style={css(ddo.check)}>
                                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3.5 8.5l3 3 6-7"></path>
                                          </svg>
                                        </span>
                                        {" "}
                                        <span style={css("flex: 1")}>{ddo.label}</span>
                                      </button>
                                    </Fragment>
                                  ))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </section>
                      {" "}
                      <section aria-labelledby="st-not" style={css(V.ui.panel)}>
                        <h2 id="st-not" style={css(V.ui.h3)}>My notifications</h2>
                        {" "}
                        {(V.pf.notifs || []).map((pn, pn__i) => (
                          <Fragment key={pn__i}>
                            <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                              <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                                <span style={css("font-size: 14px; color: var(--ink)")}>{pn.label}</span>
                                <span style={css("font-size: 12px; color: var(--muted-2)")}>{pn.desc}</span>
                              </span>
                              {" "}
                              <button type="button" role="switch" aria-checked={pn.on} aria-label={pn.label} onClick={pn.toggle} style={css(V.ui.swBtn)}>
                                <span aria-hidden="true" style={css(pn.track)}>
                                  <span style={css(pn.knob)}></span>
                                </span>
                              </button>
                            </div>
                          </Fragment>
                        ))}
                      </section>
                      {" "}
                      <section aria-labelledby="st-sec" style={css(V.ui.panel)}>
                        <h2 id="st-sec" style={css(V.ui.h3)}>Security</h2>
                        {" "}
                        <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                          <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                            <span style={css("font-size: 14px; color: var(--ink)")}>Password</span>
                            <span style={css("font-size: 12px; color: var(--muted-2)")}>{V.pf.pwSub}</span>
                          </span>
                          {" "}
                          <button type="button" onClick={V.pf.changePassword} style={css(V.ui.btnGhost)}>Change</button>
                        </div>
                        {" "}
                        <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 12px")}>
                          <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                            <span style={css("font-size: 14px; color: var(--ink)")}>Two-step sign in</span>
                            <span style={css("font-size: 12px; color: var(--muted-2)")}>Code by authenticator app</span>
                          </span>
                          {" "}
                          <button type="button" role="switch" aria-checked={V.pf.mfa.on} aria-label="Two-step sign in" onClick={V.pf.mfa.toggle} style={css(V.ui.swBtn)}>
                            <span aria-hidden="true" style={css(V.pf.mfa.track)}>
                              <span style={css(V.pf.mfa.knob)}></span>
                            </span>
                          </button>
                        </div>
                        {" "}
                        <div style={css("padding-top: 16px; border-top: 1px solid var(--line)")}>
                          <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                            <button type="button" onClick={V.pf.signOut} style={css(V.ui.btnGhost)}>Sign out</button>
                            <button type="button" onClick={V.pf.signOutAll} style={css(V.ui.btnDanger)}>Sign out of all devices</button>
                          </div>
                        </div>
                      </section>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
          {" "}
          {V.showBoard ? (
            <>
              <div className="fb-page" style={css("padding: 32px 40px 40px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px")}>
                <header style={css("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px")}>
                  <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                    <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted-2)")}>{V.todayFull}</p>
                    {" "}
                    <h1 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h1); font-weight: var(--weight-black); line-height: 1.1; letter-spacing: -0.03em; color: var(--ink)")}>{V.boardTitle}</h1>
                  </div>
                  {" "}
                  <nav aria-label="Layout" style={css("display: flex; flex-wrap: wrap; gap: 4px; padding: 5px; background: var(--track); border-radius: 16px; max-width: 100%; box-sizing: border-box")}>
                    {V.vshow.table ? (
                    <button type="button" aria-pressed={V.vp.table} onClick={V.vpick.table} style={css(V.vbtn.table)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2.5" y="3" width="11" height="10" rx="1.5"></rect>
                        <path d="M2.5 6.5h11M6.5 6.5v6.5"></path>
                      </svg>
                      {" Table "}
                    </button>
                    ) : null}
                    {" "}
                    {V.vshow.kanban ? (
                    <button type="button" aria-pressed={V.vp.kanban} onClick={V.vpick.kanban} style={css(V.vbtn.kanban)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2.5" y="3" width="3" height="10" rx="1"></rect>
                        <rect x="6.5" y="3" width="3" height="7" rx="1"></rect>
                        <rect x="10.5" y="3" width="3" height="5" rx="1"></rect>
                      </svg>
                      {" Kanban "}
                    </button>
                    ) : null}
                    {" "}
                    {V.vshow.list ? (
                    <button type="button" aria-pressed={V.vp.list} onClick={V.vpick.list} style={css(V.vbtn.list)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"></path>
                        <path d="M2.75 4.5h.01M2.75 8h.01M2.75 11.5h.01" strokeWidth="2"></path>
                      </svg>
                      {" List "}
                    </button>
                    ) : null}
                    {" "}
                    {V.vshow.timeline ? (
                    <button type="button" aria-pressed={V.vp.timeline} onClick={V.vpick.timeline} style={css(V.vbtn.timeline)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2.5 4.5h6.5M5 8h8.5M3.5 11.5h5"></path>
                      </svg>
                      {" Timeline "}
                    </button>
                    ) : null}
                    {" "}
                    {V.vshow.calendar ? (
                    <button type="button" aria-pressed={V.vp.calendar} onClick={V.vpick.calendar} style={css(V.vbtn.calendar)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5"></rect>
                        <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"></path>
                      </svg>
                      {" Calendar "}
                    </button>
                    ) : null}
                  </nav>
                  {" "}
                  <div style={css("display: flex; gap: 8px; align-items: center; flex-wrap: wrap")}>
                    {V.readOnly ? (
                      <>
                        <span style={css("display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 14px; border-radius: 999px; background: var(--inv); color: var(--inv-ink); font-size: var(--text-body-sm); font-weight: 600")}>
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                            <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.5"></path>
                            <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"></circle>
                          </svg>
                          {" View only "}
                        </span>
                      </>
                    ) : null}
                    {" "}
                    {V.canEdit ? (
                      <>
                        <button type="button" onClick={V.newProject} style={css("min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); display: inline-flex; align-items: center; gap: 8px; cursor: pointer")}>
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                          </svg>
                          {" New project "}
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>
                {" "}
                <div style={css("display: flex; flex-direction: column; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid var(--line)")}>
                  {V.menuOpen ? (
                    <>
                      <button type="button" aria-label="Close menu" onClick={V.closeMenu} style={css("position: fixed; inset: 0; z-index: 20; background: transparent; border: 0; cursor: default")}></button>
                    </>
                  ) : null}
                  {" "}
                  <div style={css("position: relative; z-index: 25; display: flex; flex-wrap: wrap; gap: 4px; align-items: center")}>
                    <div style={css("position: relative; display: flex; align-items: center; flex: 1 1 180px; max-width: 240px; margin-right: 4px")}>
                      <label htmlFor="board-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search projects</label>
                      {" "}
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                      </svg>
                      {" "}
                      <input id="board-search" type="search" placeholder="Search projects" onChange={V.onSearch} style={css("width: 100%; min-height: 40px; box-sizing: border-box; padding: 0 14px 0 38px; border: 1px solid transparent; border-radius: 12px; background: var(--chip); font-size: var(--text-body-sm); color: var(--ink)")} />
                    </div>
                    {" "}
                    <button type="button" aria-expanded={V.viewExp} onClick={V.toggleViewBar} className="fb-ni" style={css(V.viewBtn)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"></path>
                        <circle cx="5.5" cy="4.5" r="1.5" fill="var(--surface)"></circle>
                        <circle cx="10.5" cy="8" r="1.5" fill="var(--surface)"></circle>
                        <circle cx="7" cy="11.5" r="1.5" fill="var(--surface)"></circle>
                      </svg>
                      {" "}
                      <span>View</span>
                      {" "}
                      {V.viewActive ? (
                        <>
                          <span style={css(V.countBadge)}>{V.viewCount}</span>
                        </>
                      ) : null}
                      {" "}
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" style={css(V.viewChev)}>
                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                    {" "}
                    {V.viewOpen ? (
                      <>
                        <div aria-hidden="true" style={css("flex-basis: 100%; height: 0")}></div>
                        {" "}
                        {V.showPerson ? (
                          <>
                            <div style={css("position: relative")}>
                              <button type="button" aria-expanded={V.ex.person} onClick={V.open.person} className="fb-ni" style={css(V.tool.person)}>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                  <circle cx="8" cy="6" r="2.5"></circle>
                                  <path d="M3.5 13.5c.8-2.3 2.5-3.5 4.5-3.5s3.7 1.2 4.5 3.5"></path>
                                </svg>
                                {" "}
                                <span>Person</span>
                                {" "}
                                {V.personActive ? (
                                  <>
                                    <span style={css(V.countBadge)}>{V.personName}</span>
                                  </>
                                ) : null}
                              </button>
                              {" "}
                              {V.menus.person ? (
                                <>
                                  <div style={css(V.popStyle)}>
                                    <p style={css(V.secStyle)}>Filter by person</p>
                                    {" "}
                                    {(V.personItems || []).map((it, it__i) => (
                                      <Fragment key={it__i}>
                                        <button type="button" aria-pressed={it.pressed} onClick={it.pick} style={css(it.style)}>
                                          <span style={css(it.checkStyle)}>
                                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M3.5 8.5l3 3 6-7"></path>
                                            </svg>
                                          </span>
                                          {" "}
                                          <span style={css("flex: 1")}>{it.label}</span>
                                          {" "}
                                          <span style={css("font-size: var(--text-caption); color: var(--muted-2); font-variant-numeric: tabular-nums")}>{it.meta}</span>
                                        </button>
                                      </Fragment>
                                    ))}
                                    {" "}
                                    <div style={css("border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px")}>
                                      <button type="button" className="mitem" onClick={V.openPersonModal} style={css(V.addItem)}>
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                          <path d="M8 3v10M3 8h10"></path>
                                        </svg>
                                        {" Add person to view "}
                                      </button>
                                    </div>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                        {" "}
                        <div style={css("position: relative")}>
                          <button type="button" aria-expanded={V.ex.filter} onClick={V.open.filter} className="fb-ni" style={css(V.tool.filter)}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                              <path d="M2.5 3.5h11l-4.25 5v4l-2.5 1.25v-5.25z"></path>
                            </svg>
                            {" "}
                            <span>Filter</span>
                            {" "}
                            {V.filterActive ? (
                              <>
                                <span style={css(V.countBadge)}>{V.filterCount}</span>
                              </>
                            ) : null}
                          </button>
                          {" "}
                          {/* app: Filter by (components/studio/FilterBar.jsx) */}
                          {V.menus.filter ? <FilterBy fx={V.fx} onClose={V.fx.closeMenu} /> : null}
                        </div>
                        {" "}
                        <div style={css("position: relative")}>
                          <button type="button" aria-expanded={V.ex.sort} onClick={V.open.sort} className="fb-ni" style={css(V.tool.sort)}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 3v10M2.75 5.25L5 3l2.25 2.25M11 13V3M8.75 10.75L11 13l2.25-2.25"></path>
                            </svg>
                            {" "}
                            <span>Sort</span>
                            {" "}
                            {V.sortActive ? (
                              <>
                                <span style={css("font-weight: 500; color: var(--muted)")}>{V.sortLabel}</span>
                              </>
                            ) : null}
                          </button>
                          {" "}
                          {/* app: multi-sort editor (components/studio/FilterBar.jsx) */}
                          {V.menus.sort ? <SortEditor sort={V.fx.sort} onClose={V.fx.closeMenu} /> : null}
                        </div>
                        {" "}
                        <div style={css("position: relative")}>
                          <button type="button" aria-expanded={V.ex.cols} onClick={V.open.cols} className="fb-ni" style={css(V.tool.cols)}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2.5" y="3" width="11" height="10" rx="1.5"></rect>
                              <path d="M6.17 3v10M9.83 3v10"></path>
                            </svg>
                            {" "}
                            <span>Columns</span>
                            {" "}
                            {V.colsActive ? (
                              <>
                                <span style={css(V.countBadge)}>{V.hiddenText}</span>
                              </>
                            ) : null}
                          </button>
                          {" "}
                          {V.menus.cols ? <PropertiesPanel vp={V.vp} onClose={V.fx.closeMenu} /> : null}
                        </div>
                        {" "}
                        <div style={css("position: relative")}>
                          <button type="button" aria-expanded={V.ex.group} onClick={V.open.group} className="fb-ni" style={css(V.tool.group)}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2.5" y="2.5" width="11" height="4" rx="1"></rect>
                              <rect x="2.5" y="9.5" width="11" height="4" rx="1"></rect>
                            </svg>
                            {" "}
                            <span>Group by</span>
                            {" "}
                            <span style={css("font-weight: 500; color: var(--muted)")}>{V.groupLabel}</span>
                          </button>
                          {" "}
                          {V.menus.group ? <GroupPanel g={V.vp.group} onClose={V.fx.closeMenu} /> : null}
                        </div>
                      </>
                    ) : null}
                    {" "}
                    {V.showTodos ? (
                      <>
                        <button type="button" aria-pressed={V.todosPressed} onClick={V.toggleTodos} className="fb-ni" style={css(V.tool.todos)}>
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.5 4l1 1 2-2M2.5 9l1 1 2-2M7.5 4.5h6M7.5 9.5h6M7.5 13h6"></path>
                          </svg>
                          {" "}
                          <span>To-Dos</span>
                          {" "}
                          <span style={css(V.todoBadge)}>{V.pendingCount}</span>
                        </button>
                      </>
                    ) : null}
                    {" "}
                    {V.showActivity ? (
                      <>
                        <div style={css("position: relative")}>
                          <button type="button" aria-expanded={V.ex.activity} onClick={V.open.activity} className="fb-ni" style={css(V.tool.activity)}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3"></path>
                            </svg>
                            {" "}
                            <span>Activity</span>
                            {" "}
                            <span style={css(V.activityBadge)}>{V.activityCount}</span>
                          </button>
                          {" "}
                          {V.menus.activity ? (
                            <>
                              <div style={css(V.popStyleActivity)}>
                                <div style={css("display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 4px")}>
                                  <p style={css("margin: 0; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Recent activity</p>
                                  {" "}
                                  <a href="#" onClick={V.viewAllActivity} style={css("font-size: var(--text-caption); font-weight: 600; color: var(--ink)")}>View all</a>
                                </div>
                                {" "}
                                {(V.activityItems || []).map((a, a__i) => (
                                  <Fragment key={a__i}>
                                    <button type="button" className="mitem" onClick={a.open} style={css("display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-weight: 400; line-height: 1.45; cursor: pointer")}>
                                      <span aria-hidden="true" style={css(a.avatarStyle)}>{a.initials}</span>
                                      {" "}
                                      <span style={css("flex: 1; min-width: 0; font-size: 13px; line-height: 1.45; color: var(--ink-3)")}>
                                        <span style={css("font-weight: 600; color: var(--ink)")}>{a.who}</span>
                                        {" "}
                                        <span>{a.action}</span>
                                        {" "}
                                        <span style={css("font-weight: 600; color: var(--ink)")}>{a.target}</span>
                                        {" "}
                                        <span style={css("display: block; margin-top: 2px; font-size: var(--text-caption); color: var(--muted-2)")}>{a.time}</span>
                                      </span>
                                      {" "}
                                      <span aria-hidden="true" style={css(a.dotStyle)}></span>
                                    </button>
                                  </Fragment>
                                ))}
                                {" "}
                                {V.noActivity ? (
                                  <>
                                    <p style={css("margin: 0; padding: 16px 10px; font-size: var(--text-body-sm); color: var(--muted)")}>No activity for this view yet.</p>
                                  </>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    {" "}
                    <div style={css("position: relative")}>
                      <button type="button" aria-expanded={V.ex.more} aria-label="More options" onClick={V.open.more} className="fb-ni" style={css(V.tool.moreBtn)}>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="3.5" cy="8" r="1.25"></circle>
                          <circle cx="8" cy="8" r="1.25"></circle>
                          <circle cx="12.5" cy="8" r="1.25"></circle>
                        </svg>
                      </button>
                      {" "}
                      {V.menus.more ? <LayoutPanel l={V.vp.layout} archive={V.archiveItems} collapseAll={V.collapseAll} expandAll={V.expandAll} onClose={V.fx.closeMenu} /> : null}
                    </div>
                  </div>
                  {/* app: filter and sort chips under the toolbar */}
                  {V.fx.show ? <FilterChips fx={V.fx} dark={V.dark} /> : null}
                  {" "}
                  <div style={css("display: flex; flex-direction: column; gap: 8px; padding: 2px 6px 4px")}>
                    <div style={css("display: flex; gap: 4px; height: 8px")}>
                      {(V.pipeline || []).map((p, p__i) => (
                        <Fragment key={p__i}>
                          <div style={css(p.barStyle)}></div>
                        </Fragment>
                      ))}
                    </div>
                    {" "}
                    <div style={css("display: flex; flex-wrap: wrap; gap: 6px 24px")}>
                      {(V.pipeline || []).map((p, p__i) => (
                        <Fragment key={p__i}>
                          <span style={css("display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-caption); color: var(--muted)")}>
                            <span aria-hidden="true" style={css(p.dotStyle)}></span>
                            {" "}
                            <span>{p.label}</span>
                            {" "}
                            <span style={css("font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums")}>{p.count}</span>
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                {" "}
                {V.todosOpen ? (
                  <>
                    <section aria-label="My tasks" style={css("background: var(--surface); border: 1px solid var(--line-3); border-radius: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03)")}>
                      <div style={css("display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--line)")}>
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#E0567F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 4l1 1 2-2M2.5 9l1 1 2-2M7.5 4.5h6M7.5 9.5h6M7.5 13h6"></path>
                        </svg>
                        {" "}
                        <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em")}>My Tasks</h2>
                        {" "}
                        <span style={css("font-size: var(--text-caption); color: var(--muted-2)")}>{V.pendingText}</span>
                      </div>
                      {" "}
                      {(V.tasks || []).map((tk, tk__i) => (
                        <Fragment key={tk__i}>
                          <div className="row" style={css("display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 20px 0 8px; border-bottom: 1px solid var(--line)")}>
                            <button type="button" aria-pressed={tk.pressed} aria-label={tk.aria} onClick={tk.toggle} style={css("width: 44px; height: 44px; flex: none; border: 0; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                              <span style={css(tk.boxStyle)}>
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={css(tk.checkStyle)}>
                                  <path d="M3.5 8.5l3 3 6-7"></path>
                                </svg>
                              </span>
                            </button>
                            {" "}
                            <span style={css(tk.textStyle)}>{tk.text}</span>
                            {" "}
                            <span style={css(tk.prStyle)}>{tk.pr}</span>
                          </div>
                        </Fragment>
                      ))}
                    {/* app: add a task */}
<div style={css("display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 20px 0 20px")}><label htmlFor="task-new" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Add a task</label><input id="task-new" type="text" autoComplete="off" placeholder="Add a task and press Enter" value={V.newTask ?? ''} onChange={V.onNewTask} onKeyDown={V.addTask} style={css("flex: 1; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 0 12px; border: 1px solid transparent; border-radius: 12px; background: var(--chip); font-size: var(--text-body-sm); color: var(--ink)")} /></div>
</section>
                  </>
                ) : null}
                {" "}
                {V.isTable ? (
                  <>
                    <div style={css("position: relative")}>
                      <div style={css(V.tableScroll)}>
                        <div data-table="" style={css(V.tableWrapStyle)}>
                          {(V.groups || []).map((g, g__i) => (
                            <Fragment key={g__i}>
                              <section aria-label={g.title} style={css("margin-bottom: 28px")}>
                                <div style={css("position: sticky; left: 0; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; margin-left: -8px; width: max-content;" + g.headTint)}>
                                  <button type="button" aria-expanded={g.expanded} aria-label={g.toggleLabel} onClick={g.toggle} className="fb-ni" style={css("width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-4); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(g.chevStyle)}>
                                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                    </svg>
                                  </button>
                                  {" "}
                                  <span aria-hidden="true" style={css(g.dotStyle)}></span>
                                  {" "}
                                  <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); line-height: 1.2; letter-spacing: -0.02em; color: var(--ink)")}>{g.title}</h2>
                                  {" "}
                                  {g.showCount ? <span style={css("display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: var(--chip-2); color: var(--ink-2); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;")}>{g.countText}</span> : null}
                                </div>
                                {" "}
                                {g.open ? (
                                  <>
                                    <div>
                                      <div style={css("border: 1px solid var(--line); border-radius: 16px; background: var(--surface)")}>
                                        <div style={css(g.gridStyle)}>
                                          {(g.head || []).map((h, h__i) => (
                                            <Fragment key={h__i}>
                                              {/* app: column headers with the header menu (components/studio/HeaderCell.jsx) */}
                                              {h.isAdd ? (
                                                <div className={h.cls} data-col={h.col} style={css(h.style)}>
                                                  <button type="button" className="mitem" aria-label="Add a column" aria-expanded={h.quickOpen} onClick={h.onAdd} style={css("width: 44px; height: 40px; border: 0; border-radius: 10px; color: var(--ink-3); display: flex; align-items: center; justify-content: center; cursor: pointer; " + (h.quickOpen ? "background: var(--hover); box-shadow: inset 0 0 0 2px var(--ink); color: var(--ink);" : "background: transparent;"))}>
                                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                        <path d="M8 3v10M3 8h10"></path>
                                                      </svg>
                                                    </button>
                                                  {h.quick ? <QuickAdd q={h.quick} /> : null}
                                                </div>
                                              ) : <HeaderCell h={h} dark={V.dark} />}
                                            </Fragment>
                                          ))}
                                        </div>
                                        {" "}
                                        {(g.rows || []).map((r, r__i) => (
                                          <Fragment key={r__i}>
                                            <div className={r.cls} style={css(r.gridStyle)}>
                                              {(r.cells || []).map((c, c__i) => (
                                                <Fragment key={c__i}>
                                                  <div className={c.cls} style={css(c.style)}>
                                                    {c.isTitle ? (
                                                      <>
                                                        <button type="button" className="fb-title" onClick={c.open} style={css(V.titleBtn)}>
                                                          <span style={css(c.titleTextStyle)}>{c.text}</span>
                                                        </button>
                                                        {" "}
                                                        {c.hasUpdates ? (
                                                          <>
                                                            <span style={css("display: inline-flex; align-items: center; gap: 4px; flex: none; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--chip-2); font-size: var(--text-caption); font-weight: 600; color: var(--ink-3)")}>
                                                              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                                                <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path>
                                                              </svg>
                                                              {" "}
                                                              <span>{c.updates}</span>
                                                              {" "}
                                                              <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>updates</span>
                                                            </span>
                                                          </>
                                                        ) : null}
                                                      </>
                                                    ) : null}
                                                    {" "}
                                                    {c.isCellBtn ? (
                                                      <>
                                                        <button type="button" className="fb-cell" aria-label={c.aria} aria-haspopup={c.haspop} aria-expanded={c.exp} onClick={c.edit} style={css(c.btnStyle)}>
                                                          {c.isText ? (
                                                            <>
                                                              <span style={css(c.textStyle)}>{c.text}</span>
                                                            </>
                                                          ) : null}
                                                          {" "}
                                                          {c.isPill ? (
                                                            <>
                                                              <span style={css(c.pillStyle)}>{c.text}</span>
                                                            </>
                                                          ) : null}
                                                          {/* app: Select and Multi select pills, then +N */}
                                                          {c.isChips ? (c.chips || []).map((ch, ch__i) => <span key={ch__i} style={css(ch.style)}>{ch.dot ? <span aria-hidden="true" style={css(ch.dot)}></span> : null}{ch.text}</span>) : null}
                                                          {" "}
                                                          {c.isDate ? (
                                                            <>
                                                              <span style={css(c.chipStyle)}>{c.text}</span>
                                                            </>
                                                          ) : null}
                                                          {" "}
                                                          {c.isPerson ? (
                                                            <>
                                                              <span style={css("display: flex; align-items: center; gap: 8px; min-width: 0")}>
                                                                <span aria-hidden="true" style={css(c.avatarStyle)}>{c.initials}</span>
                                                                {" "}
                                                                <span style={css("overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2)")}>{c.text}</span>
                                                              </span>
                                                            </>
                                                          ) : null}
                                                          {" "}
                                                          {c.isDot ? (
                                                            <>
                                                              <span aria-hidden="true" style={css(c.dotStyle)}></span>
                                                              {" "}
                                                              <span style={css("white-space: nowrap; color: var(--ink-2)")}>{c.text}</span>
                                                            </>
                                                          ) : null}
                                                          {" "}
                                                          {c.isLink ? (
                                                            <>
                                                              <span style={css(c.linkStyle)}>
                                                                <span>{c.text}</span>
                                                                {" "}
                                                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                                                  <path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                                                </svg>
                                                              </span>
                                                            </>
                                                          ) : null}
                                                          {" "}
                                                          {c.plus ? (
                                                            <>
                                                              <span className="fb-plus" aria-hidden="true" style={css("position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--muted-2)")}>
                                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                                  <path d="M8 3v10M3 8h10"></path>
                                                                </svg>
                                                              </span>
                                                            </>
                                                          ) : null}
                                                        </button>
                                                        {" "}
                                                        {c.editing ? <CellPop ce={V.ce} popStyle={c.popStyle} close={V.closeCell} dark={V.dark} /> : null}
                                                      </>
                                                    ) : null}
                                                  </div>
                                                </Fragment>
                                              ))}
                                            </div>
                                          </Fragment>
                                        ))}
                                        {" "}
                                        {/* app: footer totals for number columns (Edit property > Footer total) */}
                                        {g.hasCalc ? (
                                          <div style={css(g.gridStyle)}>
                                            {(g.calc || []).map((cc, cc__i) => (
                                              <div key={cc__i} style={css(cc.style)}>
                                                {cc.label ? <span>{cc.label}</span> : null}
                                                {cc.value ? <span style={css("font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums")}>{cc.value}</span> : null}
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                        {g.isEmpty && g.noMatch ? <NoMatch text={g.noMatchText} fx={V.fx} /> : null}
                                        {g.isEmpty && !g.noMatch ? (
                                          <>
                                            <div style={css("padding: 20px; font-size: var(--text-body-sm); color: var(--muted); border-bottom: 1px solid var(--line)")}>{g.emptyText}</div>
                                          </>
                                        ) : null}
                                        {" "}
                                        {g.canEdit ? (
                                          <>
                                            <button type="button" onClick={g.add} style={css("display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 0 16px; border: 0; border-radius: 0 0 16px 16px; background: transparent; color: var(--muted-2); font-weight: 500; text-align: left; cursor: pointer")}>
                                              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                                <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                              </svg>
                                              {" Add project "}
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  </>
                                ) : null}
                              </section>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      {" "}
                      {V.tableFade ? (
                        <>
                          <div aria-hidden="true" style={css("position: absolute; top: 0; right: 0; bottom: 8px; width: 48px; z-index: 3; pointer-events: none; background: linear-gradient(to right, transparent, var(--surface))")}></div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {" "}
                {V.isKanban ? (
                  <>
                    <div style={css("position: relative; overflow-x: auto; padding-bottom: 8px")}>
                      <div style={css("display: flex; gap: 16px; align-items: flex-start; width: 100%")}>
                        {(V.groups || []).map((g, g__i) => (
                          <Fragment key={g__i}>
                            <section aria-label={g.title} style={css(g.kanStyle)} onDragOver={g.onDragOver} onDragLeave={g.onDragLeave} onDrop={g.onDrop}>
                              <div style={css("display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 8px")}>
                                <span aria-hidden="true" style={css(g.dotStyle)}></span>
                                {" "}
                                <h2 style={css("margin: 0; flex: 1; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink)")}>{g.title}</h2>
                                {" "}
                                {g.showCount ? <span style={css("display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--surface); font-size: var(--text-caption); font-weight: 600; color: var(--ink-3); font-variant-numeric: tabular-nums")}>{g.countText}</span> : null}
                                {" "}
                                {g.canEdit ? (
                                  <>
                                    <button type="button" aria-label={g.addLabel} onClick={g.add} style={css("width: 44px; height: 44px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                                        <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                      </svg>
                                    </button>
                                  </>
                                ) : null}
                              </div>
                              {" "}
                              {g.open ? (
                                <>
                                  {(g.cards || []).map((k, k__i) => (
                                    <Fragment key={k__i}>
                                      <article className="fb-card fb-pcard" style={css(k.cardStyle)} onKeyDown={k.onKey} draggable={k.draggable ? "true" : undefined} onDragStart={k.onDragStart} onDragEnd={k.onDragEnd}>
                                        {/* app: project card (docs/design/project-card/ProjectCard.dc.html) */}
                                        <div style={css("display: flex; align-items: center; gap: 8px; min-height: 24px")}>
                                          {k.hasType ? <span style={css(k.typeStyle)}>{k.typeText}</span> : null}
                                          {k.job ? <span style={css("font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--faint); font-variant-numeric: tabular-nums; white-space: nowrap")}>{k.job}</span> : null}
                                          {k.hasMenu ? (
                                            <button type="button" className="fb-more fb-ni" aria-label={k.menuLabel} aria-haspopup="menu" aria-expanded={k.menuOpen ? "true" : "false"} onClick={k.toggleMenu} style={css("position: relative; z-index: 2; margin-left: auto; margin-right: -6px; width: 28px; height: 28px; flex: none; padding: 0; border: 0; border-radius: 8px; background: " + (k.menuOpen ? "var(--hover)" : "transparent") + "; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.3" fill="currentColor"></circle><circle cx="8" cy="8" r="1.3" fill="currentColor"></circle><circle cx="12.5" cy="8" r="1.3" fill="currentColor"></circle></svg>
                                            </button>
                                          ) : null}
                                        </div>
                                        {k.menuOpen ? (
                                          <>
                                            <button type="button" tabIndex="-1" aria-label="Close menu" onClick={k.closeMenu} style={css("position: fixed; inset: 0; z-index: 3; border: 0; background: transparent; cursor: default")}></button>
                                            <div role="menu" aria-label={k.menuLabel} style={css("position: absolute; z-index: 4; top: 42px; right: 8px; width: 220px; padding: 6px; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.16)")}>
                                              {k.menu.map((mi) => (
                                                <Fragment key={mi.label}>
                                                  {mi.sep ? <div role="separator" style={css("margin: 6px 4px; border-top: 1px solid var(--line)")}></div> : null}
                                                  <button type="button" role="menuitem" className="mitem" onClick={mi.pick} autoFocus={mi.label === 'Open'} style={css("display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; color: " + (mi.danger ? "var(--red-ink)" : "var(--ink)"))}>
                                                    <span style={css("flex: 1")}>{mi.label}</span>
                                                    {mi.hint ? <span style={css("font-size: 11.5px; color: var(--faint)")}>{mi.hint}</span> : null}
                                                  </button>
                                                </Fragment>
                                              ))}
                                            </div>
                                          </>
                                        ) : null}
                                        {k.hasCover ? (
                                          <div aria-hidden="true" style={css("margin: 0 -6px; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--panel)")}>
                                            <img src={k.cover} alt="" loading="lazy" style={css("width: 100%; height: 100%; object-fit: cover; display: block")} />
                                          </div>
                                        ) : null}
                                        <h3 style={css(k.titleStyle)}>
                                          <button type="button" className="fb-title fb-stretch" onClick={k.open} style={css(V.cardTitleBtn + " font-size: inherit; font-weight: inherit; line-height: inherit; color: inherit;")}>
                                            <span>{k.title}</span>
                                          </button>
                                        </h3>
                                        {k.hasFlags ? (
                                          <div style={css("display: flex; flex-wrap: wrap; gap: 6px")}>
                                            {k.hasStatus ? <span style={css(k.statusStyle)}><span aria-hidden="true" style={css(k.statusDot)}></span>{k.statusText}</span> : null}
                                            {(k.flags || []).map((fl, fl__i) => (
                                              <span key={fl__i} style={css(fl.style)}>
                                                {fl.warn ? <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16"><path d="M8 2.5l6 10.5H2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"></path><path d="M8 6.5v3M8 11.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path></svg> : null}
                                                {fl.text}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                        {k.hasPipe ? (
                                          <div role="img" aria-label={"Pipeline: " + k.pipeLabel} title={k.pipeLabel} style={css("display: flex; gap: 3px; align-items: center")}>
                                            {k.pipe.map((ps, ps__i) => <span key={ps__i} style={css(ps.style)}></span>)}
                                          </div>
                                        ) : null}
                                        {k.hasFoot ? (
                                          <div style={css("display: flex; align-items: center; gap: 10px; min-width: 0; padding-top: 10px; border-top: 1px solid var(--line)")}>
                                            {k.hasAvatars ? (
                                              <div style={css("display: flex; align-items: center")}>
                                                {k.avatars.map((av, av__i) => <span key={av__i} aria-hidden="true" title={av.title} style={css(av.style + (av__i ? " margin-left: -6px;" : ""))}>{av.initials}</span>)}
                                                <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{k.peopleText}</span>
                                              </div>
                                            ) : null}
                                            {(k.counts || []).map((ct) => (
                                              <span key={ct.key} title={ct.title} style={css(ct.style)}>
                                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d={ct.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                                {ct.text}
                                                {ct.hot ? <span aria-hidden="true" style={css("width: 6px; height: 6px; margin-left: 1px; border-radius: 999px; background: #E5484D")}></span> : null}
                                                <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{ct.title}</span>
                                              </span>
                                            ))}
                                            {k.hasLink ? (
                                              <a href={k.href || "#"} target={k.href ? "_blank" : undefined} rel="noopener noreferrer" style={css(k.linkStyle)}>
                                                <span style={css("overflow: hidden; text-overflow: ellipsis")}>{k.linkText}</span>
                                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" style={css("flex: none")}><path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                              </a>
                                            ) : null}
                                            <span style={css("flex: 1")}></span>
                                            {k.hasNext ? <span title={k.next.title} style={css(k.next.style)}><span style={css("font-weight: 500; opacity: 0.8")}>{k.next.label}</span>{" "}{k.next.text}</span> : null}
                                          </div>
                                        ) : null}
                                      </article>
                                    </Fragment>
                                  ))}
                                  {" "}
                                  {g.showSlot ? <div aria-hidden="true" style={css("height: 92px; flex: none; border: 1.5px dashed var(--border-strong); border-radius: 18px; background: color-mix(in srgb, var(--surface) 60%, transparent)")}></div> : null}
                                  {g.isEmpty && !g.showSlot ? (
                                    <>
                                      <div style={css("border: 1.5px dashed var(--border-2); border-radius: 18px; padding: 28px 16px; text-align: center; font-size: var(--text-body-sm); color: var(--muted)")}>No projects yet</div>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              {" "}
                              {g.closedK ? (
                                <>
                                  <button type="button" aria-expanded="false" onClick={g.toggle} style={css("display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 1.5px dashed var(--border-2); border-radius: 14px; background: transparent; font-size: var(--text-body-sm); font-weight: 600; color: var(--ink-3); cursor: pointer")}>{g.showLabel}</button>
                                </>
                              ) : null}
                              {" "}
                              {g.canEdit ? (
                                <>
                                  <button type="button" onClick={g.add} style={css("display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 0; border-radius: 14px; background: transparent; color: var(--muted); cursor: pointer")}>
                                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                    </svg>
                                    {" Add a card "}
                                  </button>
                                </>
                              ) : null}
                            </section>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.isList ? (
                  <>
                    <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                      {(V.groups || []).map((g, g__i) => (
                        <Fragment key={g__i}>
                          <section aria-label={g.title} style={css("background: var(--surface); border: 1px solid var(--line-3); border-radius: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03)")}>
                            <div style={css("display: flex; align-items: center; gap: 10px; padding: 4px 8px 4px 4px;" + g.headTint)}>
                              <button type="button" aria-expanded={g.expanded} aria-label={g.toggleLabel} onClick={g.toggle} style={css("width: 44px; height: 44px; border: 0; border-radius: 14px; background: transparent; color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(g.chevStyle)}>
                                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                </svg>
                              </button>
                              {" "}
                              <span aria-hidden="true" style={css(g.dotStyle)}></span>
                              {" "}
                              <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h6); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink)")}>{g.title}</h2>
                              {" "}
                              {g.showCount ? <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{g.countText}</span> : null}
                              {" "}
                              <span style={css("flex: 1")}></span>
                              {" "}
                              {g.canEdit ? (
                                <>
                                  <button type="button" aria-label={g.addLabel} onClick={g.add} style={css("width: 44px; height: 44px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                                      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                    </svg>
                                  </button>
                                </>
                              ) : null}
                            </div>
                            {" "}
                            {g.open ? (
                              <>
                                {(g.cards || []).map((k, k__i) => (
                                  <Fragment key={k__i}>
                                    <div className={k.rowCls} style={css("position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; min-height: 56px; padding: 8px 20px; border-top: 1px solid var(--line); box-sizing: border-box")}>
                                      <span aria-hidden="true" style={css(k.barStyle)}></span>
                                      {" "}
                                      <button type="button" className="fb-title fb-stretch" onClick={k.open} style={css(V.listTitleBtn)}>
                                        <span>{k.title}</span>
                                      </button>
                                      {" "}
                                      {k.hasType ? (
                                        <>
                                          <span style={css(k.typeStyle)}>{k.typeText}</span>
                                        </>
                                      ) : null}
                                      {" "}
                                      {(k.badges || []).map((b, b__i) => (
                                        <Fragment key={b__i}>
                                          <span style={css(b.style)}>{b.text}</span>
                                        </Fragment>
                                      ))}
                                      {" "}
                                      {(k.dates || []).map((d, d__i) => (
                                        <Fragment key={d__i}>
                                          <span style={css(d.style)}>{d.label}{" "}{d.text}</span>
                                        </Fragment>
                                      ))}
                                      {" "}
                                      <div style={css("display: flex; align-items: center; gap: 4px")}>
                                        {(k.people || []).map((pp, pp__i) => (
                                          <Fragment key={pp__i}>
                                            <span aria-hidden="true" style={css(pp.style)}>{pp.initials}</span>
                                          </Fragment>
                                        ))}
                                        {" "}
                                        <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{k.peopleText}</span>
                                      </div>
                                      {" "}
                                      {k.hasLink ? (
                                        <>
                                          <a href={k.href || "#"} target={k.href ? "_blank" : undefined} rel="noopener noreferrer" style={css(k.linkStyle)}>
                                            <span>{k.linkText}</span>
                                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                                              <path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                            </svg>
                                          </a>
                                        </>
                                      ) : null}
                                    </div>
                                  </Fragment>
                                ))}
                                {" "}
                                {g.isEmpty ? (
                                  <>
                                    <div style={css("padding: 24px 20px; border-top: 1px solid var(--line); text-align: center; font-size: var(--text-body-sm); color: var(--muted)")}>No projects</div>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </section>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
                {" "}
                {V.isTimeline ? (
                  <>
                    <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                      <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px")}>
                        <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>{V.tlTitle}</h2>
                        {" "}
                        <span style={css("display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-caption); color: var(--muted)")}>
                          <span aria-hidden="true" style={css("width: 2px; height: 14px; background: #E0567F")}></span>
                          Today
                        </span>
                        {" "}
                        <span style={css("font-size: var(--text-caption); color: var(--muted)")}>{V.tlNote}</span>
                      </div>
                      {" "}
                      <div style={css("position: relative; overflow-x: auto; border: 1px solid var(--line-3); border-radius: 20px; background: var(--surface)")}>
                        <div style={css(V.tl.wrapStyle)}>
                          <div style={css(V.tl.rowGrid)}>
                            <div style={css("position: sticky; left: 0; z-index: 3; background: var(--surface); border-right: 1px solid var(--col-line); border-bottom: 1px solid var(--line); display: flex; align-items: flex-end; padding: 0 20px 10px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Project</div>
                            {" "}
                            <div style={css("position: relative; height: 56px; border-bottom: 1px solid var(--line)")}>
                              {(V.tl.ticks || []).map((tk, tk__i) => (
                                <Fragment key={tk__i}>
                                  <span style={css(tk.style)}>{tk.label}</span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                          {" "}
                          {(V.tl.groups || []).map((g, g__i) => (
                            <Fragment key={g__i}>
                              <div style={css(V.tl.groupRow)}>
                                <div style={css("position: sticky; left: 0; display: flex; align-items: center; gap: 10px; padding: 0 20px; height: 40px; width: max-content")}>
                                  <span aria-hidden="true" style={css(g.dotStyle)}></span>
                                  {" "}
                                  <span style={css("font-family: var(--font-title); font-weight: var(--weight-black); font-size: 14px; letter-spacing: -0.01em")}>{g.title}</span>
                                  {" "}
                                  {g.showCount ? <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); font-variant-numeric: tabular-nums")}>{g.countText}</span> : null}
                                </div>
                              </div>
                              {" "}
                              {(g.items || []).map((it, it__i) => (
                                <Fragment key={it__i}>
                                  <div className="row" style={css(V.tl.rowGrid)}>
                                    <div style={css("position: sticky; left: 0; z-index: 2; background: inherit; border-right: 1px solid var(--col-line); border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 20px; min-width: 0")}>
                                      <button type="button" className="fb-title" onClick={it.open} style={css(V.titleBtn)}>
                                        <span style={css("overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>{it.title}</span>
                                      </button>
                                    </div>
                                    {" "}
                                    <div style={css(it.laneStyle)}>
                                      <span aria-hidden="true" style={css(it.todayStyle)}></span>
                                      {" "}
                                      {it.isBar ? (
                                        <>
                                          <span style={css(it.barStyle)}>{it.barText}</span>
                                        </>
                                      ) : null}
                                      {" "}
                                      {it.isMile ? (
                                        <>
                                          <span aria-hidden="true" style={css(it.mileStyle)}></span>
                                          {" "}
                                          <span style={css(it.mileLabelStyle)}>{it.mileText}</span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                </Fragment>
                              ))}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.isCalendar ? (
                  <>
                    <div style={css("display: flex; flex-direction: column; gap: 12px")}>
                      <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px")}>
                        <div style={css("display: flex; align-items: center; gap: 4px")}>
                          <button type="button" aria-label="Previous month" onClick={V.prevMonth} style={css("width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                              <path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                            </svg>
                          </button>
                          {" "}
                          <button type="button" aria-label="Next month" onClick={V.nextMonth} style={css("width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                              <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                            </svg>
                          </button>
                        </div>
                        {" "}
                        <h2 style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>{V.cal.label}</h2>
                        {" "}
                        <button type="button" onClick={V.goToday} style={css("min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--ink); cursor: pointer")}>Today</button>
                        {" "}
                        <div style={css("display: flex; flex-wrap: wrap; gap: 6px 16px; margin-left: auto")}>
                          {(V.cal.legend || []).map((lg, lg__i) => (
                            <Fragment key={lg__i}>
                              <span style={css("display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-caption); color: var(--muted)")}>
                                <span aria-hidden="true" style={css(lg.style)}></span>
                                {lg.label}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      {" "}
                      <div style={css("position: relative; overflow-x: auto")}>
                        <div style={css("min-width: 840px; background: var(--surface); border: 1px solid var(--line-3); border-radius: 20px; overflow: hidden")}>
                          <div style={css("display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--col-line)")}>
                            {(V.cal.weekdays || []).map((wd, wd__i) => (
                              <Fragment key={wd__i}>
                                <div style={css("padding: 12px; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2); border-right: 1px solid var(--col-line)")}>{wd}</div>
                              </Fragment>
                            ))}
                          </div>
                          {" "}
                          <div style={css("display: grid; grid-template-columns: repeat(7, minmax(0, 1fr))")}>
                            {(V.cal.days || []).map((d, d__i) => (
                              <Fragment key={d__i}>
                                <div style={css(d.style)}>
                                  <span style={css(d.numStyle)}>{d.num}</span>
                                  {" "}
                                  {(d.events || []).map((e, e__i) => (
                                    <Fragment key={e__i}>
                                      <button type="button" onClick={e.open} style={css(e.style)}>{e.label}</button>
                                    </Fragment>
                                  ))}
                                  {" "}
                                  {d.hasMore ? (
                                    <>
                                      {/* app: expands the day so every event is reachable */}
                                      <button type="button" onClick={d.toggleMore} aria-label={d.moreLabel} aria-expanded={d.moreText === 'Show less' ? 'true' : 'false'} style={css("align-self: flex-start; padding: 2px; border: 0; background: transparent; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--muted); text-decoration: underline; cursor: pointer")}>{d.moreText}</button>
                                    </>
                                  ) : null}
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {V.modalOpen ? (
                  <>
                    <button type="button" aria-label="Close dialog" onClick={V.closeModal} style={css("position: fixed; inset: 0; z-index: 40; background: rgba(17,17,17,0.32); border: 0; cursor: default")}></button>
                    {" "}
                    <dialog open aria-modal="true" aria-labelledby={V.modalTitleId} style={css("position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; width: 480px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.20); padding: 24px; color: var(--ink); font-family: var(--font-main)")}>
                      {V.isPersonModal ? (
                        <>
                          <div style={css("display: flex; flex-direction: column; gap: 16px")}>
                            <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 12px")}>
                              <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                                <h2 id="person-modal-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Add people to this view</h2>
                                {" "}
                                <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted)")}>Search your team or invite someone new.</p>
                              </div>
                              {" "}
                              <button type="button" aria-label="Close" onClick={V.closeModal} style={css("width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; background: var(--hover); color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9"></path>
                                </svg>
                              </button>
                            </div>
                            {" "}
                            <div style={css("position: relative; display: flex; align-items: center")}>
                              <label htmlFor="user-search" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search users</label>
                              {" "}
                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css("position: absolute; left: 14px; color: var(--muted-2)")}>
                                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6"></circle>
                                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"></path>
                              </svg>
                              {" "}
                              <input id="user-search" type="search" placeholder="Search by name or role" onChange={V.onModalSearch} style={css("width: 100%; min-height: 48px; box-sizing: border-box; padding: 0 14px 0 38px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); font-size: var(--text-body-sm); color: var(--ink)")} />
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-direction: column; border: 1px solid var(--line-3); border-radius: 16px")}>
                              {(V.dirList || []).map((u, u__i) => (
                                <Fragment key={u__i}>
                                  <div style={css(u.rowStyle)}>
                                    <span aria-hidden="true" style={css(u.avatarStyle)}>{u.initials}</span>
                                    {" "}
                                    <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column")}>
                                      <span style={css("font-size: var(--text-body-sm); font-weight: 600; color: var(--ink)")}>{u.name}</span>
                                      {" "}
                                      <span style={css("font-size: var(--text-caption); color: var(--muted-2)")}>{u.role}</span>
                                    </span>
                                    {" "}
                                    <button type="button" aria-pressed={u.pressed} aria-label={u.aria} onClick={u.toggle} style={css(u.btnStyle)}>{u.btnLabel}</button>
                                  </div>
                                </Fragment>
                              ))}
                              {" "}
                              {V.dirEmpty ? (
                                <>
                                  <p style={css("margin: 0; padding: 18px 16px; font-size: var(--text-body-sm); color: var(--muted)")}>No matches. Invite them as a new user.</p>
                                </>
                              ) : null}
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 4px")}>
                              <button type="button" onClick={V.inviteFromModal} style={css("min-height: 44px; padding: 0 16px; border: 1px dashed var(--border-strong); border-radius: 14px; background: var(--surface); color: var(--ink); display: inline-flex; align-items: center; gap: 8px; cursor: pointer")}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M8 3v10M3 8h10"></path>
                                </svg>
                                {" Invite new user "}
                              </button>
                              {" "}
                              <button type="button" onClick={V.closeModal} style={css("min-height: 44px; padding: 0 20px; border: 0; border-radius: 14px; background: var(--inv); color: var(--inv-ink); cursor: pointer")}>Done</button>
                            </div>
                          </div>
                        </>
                      ) : null}
                      {" "}
                      {V.isColumnModal && V.addCol ? <AddColumnStep2 key={V.addCol.type} m={V.addCol} dark={V.dark} /> : null}
                      {V.isColumnModal && !V.addCol ? (
                        <>
                          <div style={css("display: flex; flex-direction: column; gap: 16px")}>
                            <div style={css("display: flex; align-items: flex-start; justify-content: space-between; gap: 12px")}>
                              <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                                <h2 id="column-modal-title" style={css("margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em")}>Add a column</h2>
                                {" "}
                                <p style={css("margin: 0; font-size: var(--text-body-sm); color: var(--muted)")}>Name it, then pick a column type.</p>
                              </div>
                              {" "}
                              <button type="button" aria-label="Close" onClick={V.closeModal} style={css("width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; background: var(--hover); color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer")}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9"></path>
                                </svg>
                              </button>
                            </div>
                            {" "}
                            <div style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <label htmlFor="col-name" style={css("font-size: var(--text-caption); font-weight: 600; color: var(--ink-3)")}>Column name</label>
                              {" "}
                              <input id="col-name" type="text" placeholder="Defaults to the type name" value={V.colName} onChange={V.onColName} style={css("width: 100%; min-height: 48px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); font-size: var(--text-body-sm); color: var(--ink)")} />
                            </div>
                            {" "}
                            <p style={css("margin: 0; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Basic</p>
                            {" "}
                            <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; margin-top: -8px")}>
                              {(V.colTypesBasic || []).map((ct, ct__i) => (
                                <Fragment key={ct__i}>
                                  <button type="button" className="mitem" onClick={ct.pick} style={css(V.ctStyle)}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d={ct.icon}></path>
                                    </svg>
                                    {" "}
                                    <span>{ct.label}</span>
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                            {" "}
                            <div style={css("border-top: 1px solid var(--line)")}></div>
                            {" "}
                            <p style={css("margin: 0; font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Advanced</p>
                            {" "}
                            <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; margin-top: -8px")}>
                              {(V.colTypesAdv || []).map((ct, ct__i) => (
                                <Fragment key={ct__i}>
                                  <button type="button" className="mitem" onClick={ct.pick} style={css(V.ctStyle)}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d={ct.icon}></path>
                                    </svg>
                                    {" "}
                                    <span>{ct.label}</span>
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </dialog>
                  </>
                ) : null}
                {" "}
                {V.drawerOpen ? (
                  <>
                    <button type="button" aria-label="Close project details" onClick={V.closeDrawer} style={css("position: fixed; inset: 0; z-index: 44; border: 0; background: rgba(17,17,17,0.32); cursor: default")}></button>
                    {" "}
                    {/* app: wider drawer (Widen panel toggles it); files dropped anywhere on it upload, or attach on Comments */}
                    <dialog open aria-modal="true" aria-labelledby="drawer-title" className={"fb-dlg" + (V.dr.split ? " fb-dlg-split" : "")} onKeyDown={V.dr.onKey} onDragOver={V.dr.onDragOver} onDragLeave={V.dr.onDragLeave} onDrop={V.dr.onDrop} style={css(V.dr.panelStyle)}>
                      {V.dr.dragging ? (
                        <div aria-hidden="true" style={css("position: absolute; inset: 10px; z-index: 5; display: flex; align-items: center; justify-content: center; border: 2px dashed var(--ink); border-radius: 20px; background: color-mix(in srgb, var(--surface) 88%, transparent); font-size: 16px; font-weight: 700; color: var(--ink); pointer-events: none")}>{V.dr.dropText}</div>
                      ) : null}
                      {/* app: project modal (docs/design/project-card/CardDetail.dc.html): header, pipeline, then tabs beside the properties rail */}
                      <header className="fb-dlg-hd" style={css("position: relative; z-index: 3; flex: none; display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 0 28px")}>
                        <div style={css("display: flex; align-items: center; gap: 4px; min-width: 0")}>
                          <span style={css(V.dr.jobStyle + " white-space: nowrap;")}>{V.dr.job}</span>
                          <span style={css("display: inline-flex; align-items: center; gap: 8px; margin-left: 8px; font-size: var(--text-caption); font-weight: 600; color: var(--muted); white-space: nowrap")}>
                            <span aria-hidden="true" style={css(V.dr.stageDot)}></span>
                            {V.dr.stage}
                          </span>
                          <span style={css("flex: 1")}></span>
                          <span className="fb-dlg-x" style={css("margin-right: 4px; font-size: var(--text-caption); color: var(--muted-2); font-variant-numeric: tabular-nums; white-space: nowrap")}>{V.dr.posText}</span>
                          <button type="button" className="fb-ni" aria-label="Previous project" title="Previous project" onClick={V.dr.prev} style={css(V.dIconBtn)}>
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
                          </button>
                          <button type="button" className="fb-ni" aria-label="Next project" title="Next project" onClick={V.dr.next} style={css(V.dIconBtn)}>
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"></path></svg>
                          </button>
                          <span aria-hidden="true" className="fb-dlg-x" style={css("width: 1px; height: 20px; margin: 0 4px; background: var(--line-4)")}></span>
                          <button type="button" className="fb-ni fb-dlg-x" aria-label="Copy link" title="Copy link" onClick={V.dr.copyLink} style={css(V.dIconBtn)}>
                            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.75-.75"></path></svg>
                          </button>
                          {V.dr.canWiden ? (
                            <button type="button" className="fb-ni fb-dlg-x" aria-label={V.dr.wideLabel} aria-pressed={V.dr.wide ? "true" : "false"} title={V.dr.wideLabel} onClick={V.dr.toggleWide} style={css(V.dIconBtn)}>
                              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={V.dr.wideIcon}></path></svg>
                            </button>
                          ) : null}
                          {V.dr.more.items.length ? (
                            <span style={css("position: relative; display: inline-flex")}>
                              <button type="button" className="fb-ni" aria-label="More actions" title="More actions" aria-haspopup="menu" aria-expanded={V.dr.more.open ? "true" : "false"} onClick={V.dr.more.toggle} style={css(V.dIconBtn)}>
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.3" fill="currentColor"></circle><circle cx="8" cy="8" r="1.3" fill="currentColor"></circle><circle cx="12.5" cy="8" r="1.3" fill="currentColor"></circle></svg>
                              </button>
                              {V.dr.more.open ? (
                                <>
                                  <button type="button" tabIndex="-1" aria-label="Close menu" onClick={V.dr.more.close} style={css("position: fixed; inset: 0; z-index: 20; border: 0; background: transparent; cursor: default")}></button>
                                  <div role="menu" aria-label="More actions" style={css("position: absolute; z-index: 21; top: calc(100% + 6px); right: 0; width: 230px; padding: 6px; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line-4); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.16)")}>
                                    {V.dr.more.items.map((mi) => (
                                      <button key={mi.label} type="button" role="menuitem" className="mitem" onClick={mi.pick} style={css("display: flex; align-items: center; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; font-size: 13.5px; font-weight: 500; text-align: left; cursor: pointer; color: " + (mi.danger ? "var(--red-ink)" : "var(--ink)"))}>{mi.label}</button>
                                    ))}
                                  </div>
                                </>
                              ) : null}
                            </span>
                          ) : null}
                          <button type="button" className="fb-ni" aria-label="Close" title="Close" onClick={V.closeDrawer} style={css(V.dIconBtn)}>
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                          </button>
                        </div>
                        {/* app: click the title to rename the project in place (Super Admin) */}
                        {V.dr.titleEdit && V.dr.titleEdit.editing ? (
                          <input id="drawer-title" type="text" aria-label="Project name" autoFocus onFocus={(e) => e.target.select()} value={V.dr.titleEdit.text} onChange={V.dr.titleEdit.onText} onKeyDown={V.dr.titleEdit.onKey} onBlur={V.dr.titleEdit.save} maxLength={200}
                            className="fb-dlg-ttl" style={css("margin: 0 0 0 -9px; font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); width: calc(100% - 4px); box-sizing: border-box; padding: 2px 8px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface-2); outline: none")} />
                        ) : V.dr.titleEdit && V.dr.titleEdit.can ? (
                          <h2 id="drawer-title" style={css("margin: 0")}>
                            <button type="button" className="ttl-edit fb-dlg-ttl" onClick={V.dr.titleEdit.start} aria-label={V.dr.titleEdit.aria} title="Click to rename"
                              style={css("margin: 0 0 0 -9px; font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); display: block; width: calc(100% - 4px); text-align: left; padding: 2px 8px; border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: text")}>{V.dr.title}</button>
                          </h2>
                        ) : (
                          <h2 id="drawer-title" className="fb-dlg-ttl" style={css("margin: 0; font-family: var(--font-title); font-size: 28px; font-weight: var(--weight-black); line-height: 1.15; letter-spacing: -0.02em; color: var(--ink)")}>{V.dr.title}</h2>
                        )}
                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 16px")}>
                          {V.dr.typeBlock ? <span style={css(V.dr.typeBlock.style)}>{V.dr.typeBlock.text}</span> : null}
                          {V.dr.headStatus.show ? (
                            <span style={css("position: relative; display: inline-flex")}>
                              {V.dr.headStatus.can ? (
                                <button type="button" className="fb-stsel" aria-haspopup="dialog" aria-expanded={V.dr.headStatus.isOpen ? "true" : "false"} aria-label={"Status: " + V.dr.headStatus.text + ". Change status"} onClick={V.dr.headStatus.open} style={css(V.dr.headStatus.style + " cursor: pointer;")}>
                                  <span aria-hidden="true" style={css(V.dr.headStatus.dot)}></span>
                                  {V.dr.headStatus.text}
                                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                </button>
                              ) : (
                                <span style={css(V.dr.headStatus.style)}><span aria-hidden="true" style={css(V.dr.headStatus.dot)}></span>{V.dr.headStatus.text}</span>
                              )}
                              {V.dr.headStatus.isOpen ? <CellPop ce={V.ce} popStyle={V.drPop} close={V.closeCell} dark={V.dark} /> : null}
                            </span>
                          ) : null}
                          {V.dr.metaLine ? <span style={css("margin-left: 6px; font-size: 13px; color: var(--muted)")}>{V.dr.metaLine}</span> : null}
                        </div>
                      </header>
                      <ol aria-label="Production pipeline" className="fb-dlg-steps" style={css("flex: none; margin: 0 28px; padding: 16px 0 18px; list-style: none; display: grid; grid-template-columns: repeat(" + (V.dr.steps || []).length + ", minmax(0, 1fr)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line)")}>
                        {(V.dr.steps || []).map((st) => (
                          <li key={st.label} aria-current={st.current} style={css("position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 12px")}>
                            {!st.last ? <span aria-hidden="true" style={css(st.line)}></span> : null}
                            <span aria-hidden="true" style={css(st.marker)}></span>
                            <span style={css("margin-top: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{st.label}</span>
                            <span style={css(st.valueStyle)}>{st.value}</span>
                            {st.meta ? <span style={css("font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{st.meta}</span> : null}
                          </li>
                        ))}
                      </ol>
                      <div className="fb-dlg-body" style={css(V.dr.bodyStyle)}>
                      <div className="fb-dlg-main" style={css("display: flex; flex-direction: column; min-width: 0; min-height: 0")}>
                        <div role="tablist" aria-label="Project sections" style={css("flex: none; display: flex; gap: 24px; padding: 0 28px; border-bottom: 1px solid var(--line); overflow-x: auto")}>
                          {(V.dr.tabs || []).map((t, t__i) => (
                            <Fragment key={t__i}>
                              <button type="button" role="tab" className="fb-tab" id={t.id} aria-selected={t.selected} aria-controls="drawer-panel" onClick={t.pick} style={css(t.style + " margin-bottom: -1px;")}>
                                <span>{t.label}</span>
                                {t.hasCount ? <span style={css(t.badge)}>{t.count}</span> : null}
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      <div id="drawer-panel" role="tabpanel" aria-labelledby={V.dr.tabId} className="fb-dlg-pane" style={css("flex: 1 1 auto; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 24px 28px 32px; display: flex; flex-direction: column; gap: 28px")}>
                        {V.dr.isOverview ? (
                          <>
                            {!V.dr.split ? <div style={css("display: flex; flex-direction: column; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid var(--line)")}><DrRail V={V} /></div> : null}
                            {V.dr.brief.show ? (
                              <section aria-labelledby="dr-brief" style={css("display: flex; flex-direction: column; gap: 10px")}>
                                <h3 id="dr-brief" style={css(V.dH3)}>Brief</h3>
                                {V.dr.brief.editing ? (
                                  <textarea aria-label="Brief" autoFocus rows={6} value={V.dr.brief.draft} placeholder={V.dr.brief.placeholder} onChange={V.dr.brief.onDraft} onKeyDown={V.dr.brief.onKey} onBlur={V.dr.brief.save} style={css("width: 100%; min-height: 140px; box-sizing: border-box; padding: 14px 16px; border: 1px solid var(--ink); border-radius: 14px; background: var(--surface); font-family: inherit; font-size: 14.5px; line-height: 1.6; color: var(--ink); resize: vertical; outline: none")}></textarea>
                                ) : V.dr.brief.can ? (
                                  <button type="button" className="fb-brief" onClick={V.dr.brief.start} aria-label={V.dr.brief.has ? "Edit brief" : "Add a brief"} title="Click to edit" style={css("display: block; width: 100%; box-sizing: border-box; padding: 14px 16px; border: 1px " + (V.dr.brief.has ? "solid var(--line-4)" : "dashed var(--border-2)") + "; border-radius: 14px; background: transparent; font-family: inherit; font-size: 14.5px; font-weight: 400; letter-spacing: normal; line-height: 1.6; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; color: " + (V.dr.brief.has ? "var(--ink-2)" : "var(--faint)") + "; cursor: text")}>{V.dr.brief.has ? V.dr.brief.text : V.dr.brief.emptyText}</button>
                                ) : (
                                  <p style={css("margin: 0; padding: 14px 16px; border: 1px solid var(--line-4); border-radius: 14px; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink-2)")}>{V.dr.brief.text}</p>
                                )}
                              </section>
                            ) : null}
                            {/* app: the project's checklist (from its template) */}
                            {V.dr.checklist && V.dr.checklist.show ? (
                              <section aria-labelledby="dr-ck" style={css("display: flex; flex-direction: column; gap: 10px; padding-top: 20px; border-top: 1px solid var(--line)")}>
                                <div style={css("display: flex; align-items: center; gap: 12px")}>
                                  <h3 id="dr-ck" style={css(V.dH3)}>Checklist</h3>
                                  {V.dr.checklist.has ? <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2)")}>{V.dr.checklist.progress}</span> : null}
                                </div>
                                {V.dr.checklist.has ? <span aria-hidden="true" style={css("display: block; height: 6px; border-radius: 999px; overflow: hidden; background: var(--chip-2)")}><span style={css(V.dr.checklist.bar)}></span></span> : null}
                                {V.dr.checklist.empty ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.dr.checklist.emptyText}</p> : null}
                                <ul style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column")}>
                                  {(V.dr.checklist.items || []).map((ck) => (
                                    <li key={ck.id} style={css("display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid var(--line)")}>
                                      <button type="button" role="checkbox" aria-checked={ck.done} aria-label={ck.label} onClick={ck.toggle} style={css("width: 22px; height: 22px; flex: none; padding: 0; box-sizing: border-box; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; " + (ck.done === "true" ? "border: 0; background: var(--inv); color: var(--inv-ink);" : "border: 1.5px solid var(--border-strong); background: transparent; color: transparent;"))}>
                                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg>
                                      </button>
                                      <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px")}>
                                        <span style={css(ck.labelStyle)}>{ck.label}</span>
                                        {ck.by ? <span style={css("font-size: 12px; color: var(--muted-2)")}>{ck.by}</span> : null}
                                      </span>
                                      {ck.canRemove ? <button type="button" className="fb-ni" aria-label={ck.removeLabel} onClick={ck.remove} style={css("width: 32px; height: 32px; flex: none; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg></button> : null}
                                    </li>
                                  ))}
                                </ul>
                                {(V.dr.checklist.templates || []).length ? (
                                  <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                    {V.dr.checklist.templates.map((tp) => <button key={tp.label} type="button" onClick={tp.pick} style={css(V.ui.ghostSm + " border: 1px solid var(--border);")}>{tp.label}</button>)}
                                  </div>
                                ) : null}
                                {V.dr.checklist.canAdd ? (
                                  <div style={css("display: flex; gap: 8px")}>
                                    <input type="text" aria-label="New checklist step" placeholder="Add a step" value={V.dr.checklist.draft} onChange={V.dr.checklist.onDraft} onKeyDown={V.dr.checklist.onKey} style={css(V.fieldInput + " min-height: 40px;")} />
                                    <button type="button" onClick={V.dr.checklist.add} style={css(V.ui.ghostSm + " border: 1px solid var(--border); min-height: 40px;")}>Add</button>
                                  </div>
                                ) : null}
                              </section>
                            ) : null}
                            {/* app: the project's Social post, sent to Buffer by a Publish to Buffer workflow */}
                            {V.dr.publish && V.dr.publish.show ? (
                              <section aria-labelledby="dr-pub" style={css("display: flex; flex-direction: column; gap: 12px; padding-top: 20px; border-top: 1px solid var(--line)")}>
                                <h3 id="dr-pub" style={css(V.dH3)}>Social post</h3>
                                <p style={css("margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted)")}>{V.dr.publish.whenText}</p>
                                <label style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Caption</span>
                                  <textarea rows={4} value={V.dr.publish.caption} onChange={V.dr.publish.onCaption} onBlur={V.dr.publish.saveCaption} readOnly={V.dr.publish.readOnly} placeholder="What the post says on every channel" style={css(V.fieldInput + " min-height: 96px; padding: 10px 14px; line-height: 1.45; resize: vertical; font-family: inherit;")}></textarea>
                                </label>
                                <div role="group" aria-label="Buffer channels" style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>Channels</span>
                                  {V.dr.publish.noChannels ? <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.dr.publish.noChannels}</p> : null}
                                  <div style={css("display: flex; flex-wrap: wrap; gap: 8px")}>
                                    {V.dr.publish.channels.map((c) => (
                                      <button key={c.id} type="button" aria-pressed={c.on} disabled={V.dr.publish.readOnly} onClick={c.toggle} style={css(c.style)}>{c.label}</button>
                                    ))}
                                  </div>
                                </div>
                                {V.dr.publish.showYt ? (
                                  <label style={css("display: flex; flex-direction: column; gap: 6px")}>
                                    <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>YouTube title</span>
                                    <input type="text" maxLength={100} value={V.dr.publish.ytTitle} placeholder={V.dr.publish.ytPlaceholder} onChange={V.dr.publish.onYt} onBlur={V.dr.publish.saveYt} readOnly={V.dr.publish.readOnly} style={css(V.fieldInput)} />
                                  </label>
                                ) : null}
                                <div role="group" aria-label="When to post" style={css("display: flex; flex-direction: column; gap: 6px")}>
                                  <span style={css("font-size: var(--text-caption); font-weight: 600; color: var(--muted-2)")}>When</span>
                                  <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                    {V.dr.publish.schedules.map((x) => <button key={x.label} type="button" aria-pressed={x.on} disabled={V.dr.publish.readOnly} onClick={x.pick} style={css(x.style)}>{x.label}</button>)}
                                    {V.dr.publish.isDate ? <input type="time" aria-label="Post time" value={V.dr.publish.time} onChange={V.dr.publish.onTime} readOnly={V.dr.publish.readOnly} style={css(V.fieldInput + " width: auto; min-height: 36px;")} /> : null}
                                  </div>
                                  {V.dr.publish.isDate ? <p style={css("margin: 0; font-size: 12px; color: var(--muted-2)")}>{V.dr.publish.dateNote}</p> : null}
                                </div>
                                <p style={css("margin: 0; font-size: 13px; color: var(--ink-3)")}>{V.dr.publish.fileText}</p>
                                {V.dr.publish.history.length ? (
                                  <ul aria-label="Sent to Buffer" style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column")}>
                                    {V.dr.publish.history.map((h) => (
                                      <li key={h.id} style={css("display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid var(--line)")}>
                                        <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px")}>
                                          <span style={css(h.textStyle)}>{h.text}</span>
                                          <span style={css("font-size: 12px; color: var(--muted-2); overflow-wrap: anywhere")}>{h.sub}</span>
                                        </span>
                                        {h.canClear ? <button type="button" aria-label={h.clearLabel} onClick={h.clear} style={css(V.ui.ghostSm + " border: 1px solid var(--border);")}>Allow again</button> : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </section>
                            ) : null}
                            {" "}
                            {V.dr.filesPeek.show ? (
                              <section aria-labelledby="dr-files" style={css("display: flex; flex-direction: column; gap: 12px; padding-top: 20px; border-top: 1px solid var(--line)")}>
                                <div style={css("display: flex; align-items: center; gap: 12px")}>
                                  <h3 id="dr-files" style={css(V.dH3)}>Latest files</h3>
                                  <span style={css("flex: 1")}></span>
                                  {V.dr.filesPeek.more ? <button type="button" onClick={V.dr.filesPeek.seeAll} style={css(V.dLink + " padding: 0; min-height: 32px; border: 0; background: transparent; cursor: pointer;")}>{V.dr.filesPeek.more}</button> : null}
                                </div>
                                <div style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(min(140px, 100%), 1fr)); gap: 10px")}>
                                  {V.dr.filesPeek.items.map((fp) => (
                                    <a key={fp.key} href="#" onClick={fp.open} aria-label={"Open " + fp.name} style={css("display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--line-4); border-radius: 12px; overflow: hidden; background: var(--surface); color: var(--ink); text-decoration: none")}>
                                      <span aria-hidden="true" style={css("aspect-ratio: 16 / 10; display: flex; align-items: center; justify-content: center; background: var(--panel); overflow: hidden")}>
                                        {fp.hasPreview ? <img src={fp.preview} alt="" loading="lazy" style={css("width: 100%; height: 100%; object-fit: cover; display: block")} /> : <span style={css(fp.badge)}>{fp.typeLabel}</span>}
                                      </span>
                                      <span style={css("display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px")}>
                                        <span style={css("font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{fp.name}</span>
                                        <span style={css("font-size: 11.5px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{fp.meta}</span>
                                      </span>
                                    </a>
                                  ))}
                                  {V.dr.canUpload ? (
                                    <button type="button" onClick={V.dr.upload} style={css("min-height: 112px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px dashed var(--border-2); border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer")}>
                                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>
                                      Add file
                                    </button>
                                  ) : null}
                                </div>
                              </section>
                            ) : null}
                          </>
                        ) : null}
                        {" "}
                        {V.dr.isAssets ? (
                          <>
                            {/* app: Files tab. Search, type filter and grid / list views; images preview, documents show their type */}
                            <section aria-labelledby="dr-files" style={css("display: flex; flex-direction: column; gap: 14px")}>
                              <h3 id="dr-files" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Files</h3>
                              <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px")}>
                                {V.dr.canUpload ? (
                                  <button type="button" onClick={V.dr.upload} style={css("min-height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--ink); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer")}>
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>
                                    Add file
                                  </button>
                                ) : null}
                                {V.dr.hasRoleUpload ? (
                                  <button type="button" onClick={V.dr.roleUpload} style={css("min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--inv); color: var(--inv-ink); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer")}>
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"></path></svg>
                                    {V.dr.roleUploadLabel}
                                  </button>
                                ) : null}
                                <label style={css("flex: 1 1 200px; min-width: 0; position: relative; display: flex; align-items: center")}>
                                  <span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Search files</span>
                                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={css("position: absolute; right: 12px; color: var(--muted-2); pointer-events: none")}><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3"></path></svg>
                                  <input type="search" autoComplete="off" placeholder="Search for files" value={V.dr.fileQ} onChange={V.dr.onFileQ} style={css("width: 100%; min-height: 40px; box-sizing: border-box; padding: 0 36px 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 14px; color: var(--ink)")} />
                                </label>
                                <div role="group" aria-label="File view" style={css("flex: none; display: inline-flex; gap: 2px; padding: 3px; border-radius: 11px; background: var(--chip)")}>
                                  <button type="button" aria-label="Grid view" aria-pressed={V.dr.gridOn} title="Grid view" onClick={V.dr.setGrid} style={css(V.dr.gridBtn)}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>
                                  </button>
                                  <button type="button" aria-label="List view" aria-pressed={V.dr.listOn} title="List view" onClick={V.dr.setList} style={css(V.dr.listBtn)}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
                                  </button>
                                </div>
                              </div>
                              <div role="group" aria-label="File type" style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 6px")}>
                                {(V.dr.filters || []).map((f, f__i) => (
                                  <button key={f__i} type="button" aria-pressed={f.on} onClick={f.pick} style={css(f.style)}>{f.label}</button>
                                ))}
                                <span style={css("flex: 1")}></span>
                                <span style={css("font-size: 13px; color: var(--muted)")}>{V.dr.fileCount}</span>
                              </div>
                              {V.dr.hasFiles && V.dr.isGrid ? (
                                <ul style={css("margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr)); gap: 14px")}>
                                  {(V.dr.assets || []).map((as) => (
                                    <li key={as.key} style={css("display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--line-3); border-radius: 16px; overflow: hidden; background: var(--surface)")}>
                                      <a href="#" aria-label={as.aria} onClick={as.open} style={css("position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; background: var(--panel); color: var(--ink-3); text-decoration: none")}>
                                        {as.hasPreview ? <img src={as.preview} alt="" loading="lazy" style={css("width: 100%; height: 100%; object-fit: cover; display: block")} /> : null}
                                        {as.noPreview ? (
                                          <span style={css("display: flex; flex-direction: column; align-items: center; gap: 10px")}>
                                            <svg aria-hidden="true" width="44" height="52" viewBox="0 0 44 52" fill="none"><path d="M4 2h24l12 12v34a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--surface)" stroke="var(--line-4)" strokeWidth="2"></path><path d="M28 2v12h12" stroke="var(--line-4)" strokeWidth="2" strokeLinejoin="round"></path></svg>
                                            <span style={css(as.badgeLg)}>{as.typeLabel}</span>
                                          </span>
                                        ) : null}
                                        {as.hasVersion ? <span style={css("position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 6px; background: rgba(17,17,17,0.72); color: #FFFFFF; font-size: 12px; font-weight: 700")}>{as.version}</span> : null}
                                      </a>
                                      <div style={css("display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; min-width: 0")}>
                                        <div style={css("display: flex; align-items: center; gap: 8px; min-width: 0")}>
                                          <span style={css(as.badgeSm)}>{as.typeLabel}</span>
                                          <span title={as.name} style={css("flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{as.name}</span>
                                        </div>
                                        <span style={css("display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; color: var(--muted-2)")}>
                                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css("flex: none")}><path d={as.sourceIcon}></path></svg>
                                          <span style={css("white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{as.source}{as.size ? "  ·  " + as.size : ""}</span>
                                        </span>
                                        <span style={css("font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{as.meta}</span>
                                        <div style={css("display: flex; align-items: center; gap: 4px; margin-top: 6px")}>
                                          <a href="#" aria-label={as.aria} onClick={as.open} style={css(V.dLink + "; min-height: 32px; padding: 0 8px")}>Open</a>
                                          <button type="button" aria-label={"Download " + as.name} onClick={as.download} style={css("min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer")}>Download</button>
                                          <span style={css("flex: 1")}></span>
                                          {as.canDelete ? <button type="button" aria-label={as.delLabel + " " + as.name} onClick={as.del} style={css("min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: " + (as.confirm ? "var(--red-soft)" : "transparent") + "; color: var(--red-ink); font-size: 13px; font-weight: 600; cursor: pointer")}>{as.delLabel}</button> : null}
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {V.dr.hasFiles && V.dr.isList ? (
                                <div style={css("border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface)")}>
                                  {(V.dr.assets || []).map((as) => (
                                    <div key={as.key} style={css(as.rowStyle)}>
                                      <span aria-hidden="true" style={css("width: 44px; height: 44px; flex: none; border-radius: 10px; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: var(--panel)")}>
                                        {as.hasPreview ? <img src={as.preview} alt="" loading="lazy" style={css("width: 100%; height: 100%; object-fit: cover; display: block")} /> : <span style={css(as.badgeSm)}>{as.typeLabel}</span>}
                                      </span>
                                      <span style={css("flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px")}>
                                        <span title={as.name} style={css("font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{as.name}{as.hasVersion ? "  ·  " + as.version : ""}</span>
                                        <span style={css("font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{as.source}  ·  {as.meta}{as.size ? "  ·  " + as.size : ""}</span>
                                      </span>
                                      <a href="#" aria-label={as.aria} onClick={as.open} style={css(V.dLink)}>Open</a>
                                      <button type="button" aria-label={"Download " + as.name} title="Download" onClick={as.download} className="fb-ni" style={css(V.dIconBtn)}>
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>
                                      </button>
                                      {as.canDelete ? <button type="button" aria-label={as.delLabel + " " + as.name} onClick={as.del} style={css("flex: none; min-height: 36px; padding: 0 10px; border: 0; border-radius: 10px; background: " + (as.confirm ? "var(--red-soft)" : "transparent") + "; color: var(--red-ink); font-size: 13px; font-weight: 600; cursor: pointer")}>{as.delLabel}</button> : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {V.dr.noMatch ? <p style={css("margin: 0; padding: 20px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No files match. Clear the search or pick All.</p> : null}
                              {V.dr.assetsEmpty ? (
                                <div style={css("display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; border: 1.5px dashed var(--line-4); border-radius: 18px; text-align: center")}>
                                  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"></path></svg>
                                  <p style={css("margin: 0; max-width: 360px; font-size: var(--text-body-sm); line-height: 1.5; color: var(--muted)")}>{V.dr.emptyFiles}</p>
                                </div>
                              ) : null}
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.dr.isComments ? (
                          <>
                            {/* app: comment cards with the author's name and role, plus attached images and documents */}
                            <section aria-label="Comments" style={css("display: flex; flex-direction: column; gap: 16px")}>
                              <p style={css("margin: 0; font-size: 13px; color: var(--muted)")}>{V.dr.commentNote}</p>
                              <ol style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 18px")}>
                                {(V.dr.comments || []).map((cm, cm__i) => (
                                  <li key={cm__i} style={css("display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px")}>
                                    <span aria-hidden="true" style={css(cm.avatarStyle)}>{cm.initials}</span>
                                    <div style={css("display: flex; flex-direction: column; gap: 6px; min-width: 0")}>
                                      <div style={css(cm.bubble)}>
                                        <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px")}>
                                          <span style={css("font-size: 14px; font-weight: 700; color: var(--link)")}>{cm.who}</span>
                                          {cm.roleTag ? <span style={css("display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--chip-2); font-size: 11px; font-weight: 700; color: var(--ink-3)")}>{cm.roleTag}</span> : null}
                                          {cm.internal ? <span style={css(V.internalPill)}>Internal</span> : null}
                                        </div>
                                        {cm.editing ? (
                                          <div style={css("display: flex; flex-direction: column; gap: 8px")}>
                                            <textarea aria-label="Edit comment" rows="3" autoFocus value={cm.editText} onChange={cm.onEdit} onKeyDown={cm.onEditKey} style={css("width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); resize: vertical")} />
                                            <div style={css("display: flex; gap: 8px")}>
                                              <button type="button" onClick={cm.saveEdit} style={css(V.ui.ghostSm + " border: 1px solid var(--ink); color: var(--ink);")}>Save</button>
                                              <button type="button" onClick={cm.cancelEdit} style={css(V.ui.ghostSm)}>Cancel</button>
                                            </div>
                                          </div>
                                        ) : cm.hasText ? <p style={css("margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere")}>{cm.text}</p> : null}
                                        {cm.hasImages ? (
                                          <div style={css(cm.imgGrid)}>
                                            {cm.images.map((im) => (
                                              <button key={im.key} type="button" aria-label={"Open " + im.name} onClick={im.open} style={css("display: block; padding: 0; border: 1px solid var(--line-3); border-radius: 12px; overflow: hidden; background: var(--panel); aspect-ratio: 4 / 3; cursor: zoom-in")}>
                                                {im.has ? <img src={im.url} alt={im.name} loading="lazy" style={css("width: 100%; height: 100%; object-fit: cover; display: block")} /> : <span style={css("font-size: 12px; color: var(--muted)")}>{im.name}</span>}
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                        {cm.hasFiles ? (
                                          <div style={css("display: flex; flex-wrap: wrap; gap: 6px")}>
                                            {cm.files.map((f) => (
                                              <button key={f.key} type="button" aria-label={"Open " + f.name} onClick={f.open} style={css("display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 40px; padding: 0 12px 0 8px; border: 1px solid var(--line-3); border-radius: 10px; background: var(--surface); color: var(--ink); cursor: pointer")}>
                                                <span style={css(f.badge)}>{f.label}</span>
                                                <span style={css("min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{f.name}</span>
                                                {f.size ? <span style={css("flex: none; font-size: 12px; color: var(--muted-2)")}>{f.size}</span> : null}
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                      {/* app: edited mark, and edit or delete for the author (delete for Super Admins too) */}
                                      <span style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding-left: 4px; font-size: 12px; color: var(--muted-2)")}>
                                        <span>{cm.time}{cm.edited ? '  ·  Edited' : ''}</span>
                                        {cm.canEdit && !cm.editing ? <button type="button" onClick={cm.startEdit} style={css("padding: 0; border: 0; background: transparent; font: inherit; font-weight: 600; color: var(--ink-3); cursor: pointer")}>Edit</button> : null}
                                        {cm.canDelete && !cm.editing ? <button type="button" onClick={cm.del} style={css("padding: 0; border: 0; background: transparent; font: inherit; font-weight: 600; color: var(--red-ink); cursor: pointer")}>{cm.delLabel}</button> : null}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                              {V.dr.noComments ? <p style={css("margin: 0; padding: 20px 0; font-size: var(--text-body-sm); color: var(--muted)")}>No comments yet. Start the thread below.</p> : null}
                            </section>
                          </>
                        ) : null}
                        {" "}
                        {V.dr.isHistory ? (
                          <>
                            <section aria-label="History" style={css("display: flex; flex-direction: column; gap: 6px")}>
                              <ol style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column")}>
                                {(V.dr.history || []).map((h, h__i) => (
                                  <Fragment key={h__i}>
                                    <li style={css("display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line)")}>
                                      <span aria-hidden="true" style={css(h.avatarStyle)}>{h.initials}</span>
                                      {" "}
                                      <span style={css("flex: 1; min-width: 0; font-size: 14px; line-height: 1.45; color: var(--ink-3)")}>
                                        <span style={css("font-weight: 600; color: var(--ink)")}>{h.who}</span>
                                        {" "}
                                        <span>{h.text}</span>
                                        {" "}
                                        <span style={css("display: block; margin-top: 2px; font-size: var(--text-caption); color: var(--muted-2)")}>{h.time}</span>
                                      </span>
                                      {" "}
                                      <span aria-hidden="true" style={css(h.dotStyle)}></span>
                                    </li>
                                  </Fragment>
                                ))}
                              </ol>
                            </section>
                          </>
                        ) : null}
                      </div>
                      {" "}
                      {V.dr.isComments ? (
                      <footer style={css("flex: none; display: flex; flex-direction: column; gap: 8px; padding: 14px 28px 18px; border-top: 1px solid var(--line); background: var(--surface)")}>
                        {V.dr.isComments ? (
                          <>
                            {/* app: comment box. Shows who is posting, takes images and documents, Cmd+Enter posts */}
                            <div style={css("display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted)")}>
                              <span aria-hidden="true" style={css(V.dr.asAvatar + " width: 22px; height: 22px; font-size: 10px;")}>{V.dr.asInitial}</span>
                              <span>Commenting as <span style={css("font-weight: 700; color: var(--ink-2)")}>{V.dr.asName}</span></span>
                            </div>
                            <div style={css("display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); overflow: hidden")}>
                              <label htmlFor="dr-comment" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>Write a comment</label>
                              <textarea id="dr-comment" rows={2} disabled={!V.dr.canComment} placeholder={V.dr.placeholder} value={V.dr.draft ?? ''} onChange={V.dr.onDraft} onKeyDown={V.dr.onDraftKey} style={css("width: 100%; min-height: 56px; max-height: 180px; box-sizing: border-box; padding: 12px 14px 6px; border: 0; background: transparent; resize: vertical; font-family: inherit; font-size: 14px; line-height: 1.5; color: var(--ink); outline: none")}></textarea>
                              {V.dr.hasPending ? (
                                <div style={css("display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 10px 6px")}>
                                  {(V.dr.pending || []).map((p) => (
                                    <span key={p.key} style={css("display: inline-flex; align-items: center; gap: 6px; max-width: 240px; min-height: 36px; padding: 0 4px 0 4px; border: 1px solid var(--line-3); border-radius: 10px; background: var(--surface)")}>
                                      {p.isImage ? <img src={p.url} alt="" style={css("width: 28px; height: 28px; border-radius: 6px; object-fit: cover; display: block")} /> : <span style={css(p.badge)}>{p.label}</span>}
                                      <span style={css("min-width: 0; font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{p.name}</span>
                                      <button type="button" aria-label={"Remove " + p.name} onClick={p.remove} className="fb-ni" style={css("flex: none; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer")}>
                                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <div style={css("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px 8px 8px")}>
                                {V.dr.canAttach ? (
                                  <button type="button" onClick={V.dr.attach} className="fb-ni" style={css("min-height: 36px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer")}>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.1 12.2 20.3a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"></path></svg>
                                    Attach
                                  </button>
                                ) : null}
                                {V.dr.showInternal ? (
                                  <label style={css("display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px; font-size: 13px; color: var(--ink-3); cursor: pointer")}>
                                    <input type="checkbox" checked={!!V.dr.internalOn} onChange={V.dr.toggleInternal} style={css("width: 16px; height: 16px; margin: 0; accent-color: var(--ink)")} />
                                    {" Hide from client "}
                                  </label>
                                ) : null}
                                <span style={css("flex: 1")}></span>
                                <button type="button" disabled={!V.dr.canPost} onClick={V.dr.post} style={css(V.dr.postStyle + " min-height: 38px; border-radius: 12px;")}>Post</button>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </footer>
                      ) : null}
                      </div>
                      {V.dr.split ? (
                        <aside className="fb-dlg-rail" aria-label="Project properties" style={css("min-height: 0; overflow-y: auto; box-sizing: border-box; border-left: 1px solid var(--line); background: var(--surface-2); padding: 18px 18px 24px; display: flex; flex-direction: column; gap: 20px")}>
                          <DrRail V={V} />
                        </aside>
                      ) : null}
                      </div>
                    </dialog>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// app: the project modal's properties rail: Next step, then grouped fields. Editable rows open the board's cell
// editors under the row (cellEdit with src 'dr'); read-only rows show the value only.
const PROP_ROW = 'display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: 8px; width: 100%; min-height: 38px; padding: 3px 8px; box-sizing: border-box; border: 0; border-radius: 10px; background: transparent; font-family: inherit; font-size: 13.5px; font-weight: 500; letter-spacing: normal; line-height: 1.3; text-align: left; color: var(--ink);';
function PropValue({ f }) {
  return (
    <span style={css('min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden')}>
      {f.isText ? <span style={css(f.textStyle)}>{f.text}</span> : null}
      {f.isBlock ? <span style={css(f.blockStyle)}>{f.text}</span> : null}
      {f.isDate ? <span style={css(f.chipStyle)}>{f.text}</span> : null}
      {f.isPerson ? <><span aria-hidden="true" style={css(f.avatarStyle)}>{f.initials}</span><span style={css('white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{f.text}</span></> : null}
      {f.isDot ? <><span aria-hidden="true" style={css(f.dotStyle)}></span><span>{f.text}</span></> : null}
      {f.isLink ? <span style={css('color: var(--link); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{f.text}</span> : null}
      {f.isEmpty ? <span style={css('color: var(--faint); font-weight: 400')}>{f.emptyText}</span> : null}
      {f.rel ? <span style={css(f.relStyle + ' white-space: nowrap')}>{f.rel}</span> : null}
    </span>
  );
}
function DrRail({ V }) {
  const dr = V.dr;
  return (
    <>
      {dr.nextStep.show ? (
        <div style={css('display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line-4)')}>
          <span style={css('font-size: 12px; font-weight: 600; color: var(--muted-2)')}>Next step</span>
          {dr.nextStep.has ? (
            <button type="button" onClick={dr.nextStep.pick} style={css('display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--inv); color: var(--inv-ink); font-size: 13.5px; font-weight: 600; cursor: pointer')}>
              {dr.nextStep.label}
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>
            </button>
          ) : null}
          {dr.nextStep.others.map((o) => <button key={o.label} type="button" onClick={o.pick} style={css('width: 100%; min-height: 38px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--ink); font-size: 13.5px; font-weight: 600; cursor: pointer')}>{o.label}</button>)}
          {dr.nextStep.note ? <span style={css('font-size: 12px; line-height: 1.45; color: var(--muted)')}>{dr.nextStep.note}</span> : null}
        </div>
      ) : null}
      {dr.rail.map((g) => (
        <section key={g.title} aria-label={g.title} style={css('display: flex; flex-direction: column')}>
          <h3 style={css('margin: 0 0 4px; padding: 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted-2)')}>{g.title}</h3>
          {g.fields.map((f) => (
            <div key={f.key} style={css('position: relative')}>
              {f.isLink && !f.isOpen ? (
                <div style={css(PROP_ROW)}>
                  <span style={css('font-size: 13px; color: var(--muted)')}>{f.label}</span>
                  <span style={css('min-width: 0; display: flex; align-items: center; gap: 4px')}>
                    <a href={f.href || '#'} target={f.href ? '_blank' : undefined} rel="noopener noreferrer" style={css(f.linkStyle)}><span style={css('overflow: hidden; text-overflow: ellipsis')}>{f.text}</span></a>
                    {f.can ? (
                      <button type="button" className="fb-ni" aria-label={'Edit ' + f.label} title="Edit link" onClick={f.open} style={css('flex: none; margin-left: auto; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>
                      </button>
                    ) : null}
                  </span>
                </div>
              ) : f.can ? (
                <button type="button" className="fb-prop" aria-haspopup="dialog" aria-expanded={f.isOpen ? 'true' : 'false'} aria-label={f.aria} onClick={f.open} style={css(PROP_ROW + ' cursor: pointer;' + (f.isOpen ? ' background: var(--hover);' : ''))}>
                  <span style={css('font-size: 13px; color: var(--muted)')}>{f.label}</span>
                  <PropValue f={f} />
                </button>
              ) : (
                <div style={css(PROP_ROW)}>
                  <span style={css('font-size: 13px; color: var(--muted)')}>{f.label}</span>
                  <PropValue f={f} />
                </div>
              )}
              {f.isOpen ? <CellPop ce={V.ce} popStyle={V.drPop} close={V.closeCell} dark={V.dark} /> : null}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

// app: the board's cell editor popover, shared by table cells and the project modal's header and properties rail.
// Select fields use SelectPicker, Status the StatusPicker, typed fields CellEditor, the rest the list / date / text panel.
function CellPop({ ce, popStyle, close, dark }) {
  if (ce.isPicker) return <SelectPicker p={ce.picker} dark={dark} />;
  if (ce.isStatusPicker) return <StatusPicker p={ce.status} dark={dark} />;
  if (ce.editor) return <CellEditor e={ce.editor} dark={dark} />;
  return (
    <>
      <button type="button" tabIndex="-1" aria-label="Close editor" onClick={close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
      {" "}
      <div role="dialog" aria-label={ce.label} onKeyDown={ce.onKey} style={css(popStyle)}>
        <div style={css("display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 4px 6px 8px")}>
          <span style={css("font-size: 12px; font-weight: 600; color: var(--muted-2); white-space: nowrap")}>{ce.label}</span>
          {" "}
          <span style={css("min-width: 0; font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}>{ce.project}</span>
        </div>
        {" "}
        {ce.isList ? (
          <>
            <div role="listbox" aria-label={ce.label} style={css("display: flex; flex-direction: column; gap: 2px")}>
              {(ce.opts || []).map((co2, co2__i) => (
                <Fragment key={co2__i}>
                  <button type="button" role="option" className="mitem" aria-selected={co2.sel} onClick={co2.pick} style={css(co2.style)}>
                    <span aria-hidden="true" style={css(co2.swStyle)}>{co2.swText}</span>
                    {" "}
                    <span style={css("flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis")}>{co2.label}</span>
                    {" "}
                    <span style={css("font-size: 12px; font-weight: 500; color: var(--muted-2)")}>{co2.meta}</span>
                    {" "}
                    <span style={css(co2.check)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5l3 3 6-7"></path>
                      </svg>
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
          </>
        ) : null}
        {" "}
        {ce.isDate ? (
          <>
            <div style={css("display: flex; flex-direction: column; gap: 8px; padding: 0 2px")}>
              <div style={css("display: flex; align-items: center; justify-content: space-between; gap: 8px")}>
                <button type="button" className="fb-ni" aria-label="Previous month" onClick={ce.cal.prev} style={css(ce.navBtn)}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                    <path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
                {" "}
                <span style={css("font-size: 14px; font-weight: 700; color: var(--ink)")}>{ce.cal.label}</span>
                {" "}
                <button type="button" className="fb-ni" aria-label="Next month" onClick={ce.cal.next} style={css(ce.navBtn)}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                    <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
              </div>
              {" "}
              <div aria-hidden="true" style={css("display: grid; grid-template-columns: repeat(7, 36px); gap: 2px; justify-content: center")}>
                {(ce.cal.weekdays || []).map((wd2, wd2__i) => (
                  <Fragment key={wd2__i}>
                    <span style={css("height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--muted-2)")}>{wd2}</span>
                  </Fragment>
                ))}
              </div>
              {" "}
              <div role="group" aria-label={ce.cal.label} style={css("display: grid; grid-template-columns: repeat(7, 36px); gap: 2px; justify-content: center")}>
                {(ce.cal.days || []).map((dy, dy__i) => (
                  <Fragment key={dy__i}>
                    {dy.isDay ? (
                      <>
                        <button type="button" className="fb-day" aria-label={dy.aria} aria-pressed={dy.pressed} onClick={dy.pick} style={css(dy.style)}>{dy.num}</button>
                      </>
                    ) : null}
                    {" "}
                    {dy.isBlank ? (
                      <>
                        <span aria-hidden="true" style={css("width: 36px; height: 36px")}></span>
                      </>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              {" "}
              <div style={css("display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; border-top: 1px solid var(--line)")}>
                {(ce.quick || []).map((qk, qk__i) => (
                  <Fragment key={qk__i}>
                    <button type="button" onClick={qk.pick} style={css(ce.quickStyle)}>{qk.label}</button>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {ce.isText ? (
          <>
            <div style={css("display: flex; flex-direction: column; gap: 10px; padding: 0 4px 4px")}>
              {ce.hasOpen ? (
                <>
                  <a href={ce.openHref || "#"} target="_blank" rel="noopener noreferrer" style={css(ce.openStyle)}>
                    <span>{ce.openText}</span>
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                      <path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </a>
                </>
              ) : null}
              {" "}
              <label htmlFor="ce-text" style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>{ce.label}</label>
              {" "}
              <input id="ce-text" type="text" autoComplete="off" value={ce.text ?? ''} placeholder={ce.placeholder} onChange={ce.onText} onKeyDown={ce.onTextKey} style={css("width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
              {" "}
              <div style={css("display: flex; justify-content: flex-end; gap: 6px")}>
                <button type="button" className="fb-ni" onClick={close} style={css("min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: transparent; color: var(--ink-3); font-size: 14px; cursor: pointer")}>Cancel</button>
                {" "}
                <button type="button" onClick={ce.save} style={css("min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--inv); color: var(--inv-ink); font-size: 14px; cursor: pointer")}>Save</button>
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {ce.hasClear ? (
          <>
            <div style={css("margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--line)")}>
              <button type="button" className="mitem" onClick={ce.clear} style={css(ce.clearStyle)}>{ce.clearLabel}</button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// app: Ideas & Research helpers. DD renders a vals mkDD object; Hook renders a banner hook from banner() fields.
function DD({ d, id, className }) {
  if (!d) return null;
  return (
    <div className={className} style={css(d.wrap)} onKeyDown={d.onKey}>
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={d.exp} aria-label={d.aria} onClick={d.toggle} style={css(d.btn)}>
        <span style={css(d.valueStyle)}>{d.value}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={css(d.chev)}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>
      </button>
      {d.open ? (
        <>
          <button type="button" tabIndex="-1" aria-label="Close list" onClick={d.close} style={css("position: fixed; inset: 0; z-index: 0; border: 0; background: transparent; cursor: default")}></button>
          <div role="listbox" aria-label={d.label} style={css(d.pop)}>
            {(d.items || []).map((o, i) => (
              <button key={i} type="button" role="option" className="mitem" aria-selected={o.sel} onClick={o.pick} style={css(o.style)}>
                <span style={css(o.check)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg></span>
                <span style={css("flex: 1")}>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Hook({ b }) {
  if (!b || !b.showHook) return null;
  return (
    <span style={css(b.hookStyle)}>
      {b.hiStyle ? <span style={css(b.hiStyle)}>{b.hookHi}</span> : b.hookHi}{b.hookRest ? ' ' + b.hookRest : ''}
    </span>
  );
}

function CheckList({ items, gap }) {
  return (
    <ul style={css("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: " + (gap || '8px'))}>
      {(items || []).map((ck) => (
        <li key={ck.label} style={css("display: flex; align-items: center; gap: 8px; font-size: 13px; color: " + ck.color)}>
          <span aria-hidden="true" style={css(ck.box)}>{ck.on ? <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"></path></svg> : null}</span>
          {ck.label}<span style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}>{ck.sr}</span>
        </li>
      ))}
    </ul>
  );
}

function RefList({ refs, add, legend }) {
  return (
    <fieldset style={css("margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px")}>
      <legend style={css(legend || "padding: 0; margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--ink-2)")}>References</legend>
      {(refs || []).map((r) => (
        <div key={r.id} style={css("display: flex; gap: 8px; align-items: center")}>
          <span aria-hidden="true" style={css("width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--chip); display: flex; align-items: center; justify-content: center; color: var(--ink-3)")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></span>
          <label htmlFor={r.id} style={css("position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)")}>{r.label}</label>
          <input id={r.id} type="text" inputMode="url" autoComplete="off" placeholder="Paste a video, article or post link" value={r.value} onChange={r.onChange} style={css("flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink)")} />
          <button type="button" className="fb-ni" aria-label={r.removeLabel} onClick={r.remove} style={css("width: 44px; height: 44px; flex: none; padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center")}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"></path></svg></button>
        </div>
      ))}
      <button type="button" className="fb-ni" onClick={add} style={css("align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px dashed var(--border-strong); border-radius: 12px; background: transparent; font-size: 13px; font-weight: 600; color: var(--ink-3); cursor: pointer")}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"></path></svg>Add link</button>
    </fieldset>
  );
}

const IDEA_ICON = {
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  copy: 'M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3',
  archive: 'M3 4h18v5H3zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  trash: 'M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13'
};
function IdeaIcon({ name }) {
  if (!IDEA_ICON[name]) return null;
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={IDEA_ICON[name]}></path></svg>;
}
