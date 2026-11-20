'use client';
// Step finder (handoff StepFinder): opens from a + on the canvas. Search, kind chips, "Suggested after …", the full
// list, and an empty state. items: the builder's step library ({ id, kind, title, desc, app, spec }).
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { T, KIND, FONT, SHADOW } from '@/lib/workflow/theme';
import { KIND_LABEL, AGENT } from '@/lib/workflow/copy';
import { Svg, ICON, KindTile, srOnly, useModal } from './ui';

// What usually comes next, by the kind of the step before.
const NEXT = {
  trigger: ['data:get_project', 'split', 'slack_admin'], data: ['split', 'approval', 'slack_admin'], logic: ['slack_admin', 'task', 'delay'],
  ai: ['approval', 'slack_admin', 'email_editor'], human: ['slack_admin', 'email_editor', 'status_next'], action: ['delay', 'todo_admin', 'task'],
};

export default function StepFinder({ items, afterTitle, afterKind, groupLabel, onAdd, onClose, z = 70 }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const layer = useRef(null);
  useModal(layer, '#wf-sf-q');
  const kinds = ['data', 'action', 'logic', 'ai', 'human'].filter((k) => items.some((it) => it.kind === k));
  const ql = q.trim().toLowerCase();
  const results = items.filter((it) => (cat === 'all' || it.kind === cat) && (!ql || (it.title + ' ' + it.desc + ' ' + it.app + ' ' + (groupLabel[it.kind] || '')).toLowerCase().includes(ql)));
  const sugg = !ql && cat === 'all' ? (NEXT[afterKind] || NEXT.action).map((id) => items.find((it) => it.id === id)).filter(Boolean) : [];
  const chip = (on) => 'height: 34px; padding: 0 12px; border-radius: 999px; background: ' + (on ? T.accent : T.surface) + '; color: ' + (on ? T.accentInk : T.ink) + '; border: 1px solid ' + (on ? T.accent : T.inputLine) + '; font-weight: 600; font-size: 13px;';
  return (
    <div ref={layer} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position: fixed; inset: 0; z-index: ' + z + '; background: rgba(17,17,17,.36); display: flex; justify-content: center; align-items: flex-start; padding: 72px 16px 16px;')}>
      <div role="dialog" aria-modal="true" aria-labelledby="wf-sf-t" className="wf-pop" style={css('width: 640px; max-width: 100%; max-height: calc(100% - 40px); background: ' + T.surface + '; border-radius: 20px; box-shadow: ' + SHADOW.modal + '; display: flex; flex-direction: column; overflow: hidden; color: ' + T.ink + ';')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid ' + T.line + ';')}>
          <div style={css('min-width: 0;')}>
            <div style={css('font-size: 13px; color: ' + T.muted + ';')}>Add a step after {afterTitle}</div>
            <h2 id="wf-sf-t" style={css('margin: 2px 0 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 20px;')}>What happens next?</h2>
          </div>
          <button type="button" className="wf-h" aria-label="Close" onClick={onClose} style={css('width: 40px; height: 40px; flex: none; border-radius: 10px; background: transparent; border: 0; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={18} /></button>
        </div>
        <div style={css('padding: 14px 20px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid ' + T.line + ';')}>
          <label htmlFor="wf-sf-q" style={css(srOnly)}>Search steps</label>
          <input id="wf-sf-q" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: Slack, branch, wait, email"
            style={css('height: 46px; border-radius: 12px; background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; color: ' + T.ink + '; padding: 0 14px; font-family: inherit; font-size: 15px;')} />
          <div role="group" aria-label="Step kind" style={css('display: flex; flex-wrap: wrap; gap: 6px;')}>
            {['all'].concat(kinds).map((k) => <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} style={css(chip(cat === k))}>{k === 'all' ? 'All' : groupLabel[k] || KIND_LABEL[k]}</button>)}
          </div>
        </div>
        <div className="wf-sc" style={css('overflow: auto; padding: 14px 20px 20px; display: flex; flex-direction: column; gap: 14px;')}>
          {sugg.length ? (
            <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
              <div style={css('font-size: 13px; font-weight: 700; color: ' + T.varInk + ';')}>Suggested after {afterTitle}</div>
              <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;')}>
                {sugg.map((it) => (
                  <button key={it.id} type="button" className="wf-li" onClick={() => onAdd(it.spec)} style={css('text-align: left; padding: 12px; border-radius: 14px; background: ' + T.varBg + '; border: 1px solid ' + T.chipLine + '; color: ' + T.ink + '; display: flex; flex-direction: column; gap: 6px; min-height: 88px;')}>
                    <span style={css('font-size: 12px; font-weight: 600; color: ' + KIND[it.kind].ink + ';')}>{groupLabel[it.kind] || KIND_LABEL[it.kind]}</span>
                    <span style={css('font-weight: 700; font-size: 14px;')}>{it.title}</span>
                    <span style={css('font-size: 12px; color: ' + T.sub + '; line-height: 1.35;')}>{it.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
            {results.map((it) => (
              <button key={it.id} type="button" className="wf-li" onClick={() => onAdd(it.spec)} style={css('text-align: left; display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 12px; background: ' + T.surface + '; border: 1px solid ' + T.line + '; color: ' + T.ink + ';')}>
                <KindTile kind={it.kind} size={34} />
                <span style={css('display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;')}><span style={css('font-weight: 600; font-size: 14px;')}>{it.title}</span><span style={css('font-size: 13px; color: ' + T.muted + ';')}>{it.desc}</span></span>
                {it.off ? <span style={css('font-size: 12px; font-weight: 600; color: ' + T.warnInk + '; white-space: nowrap;')}>Not connected</span> : null}
                <span style={css('font-size: 12px; color: ' + T.muted + '; background: ' + T.ground2 + '; border-radius: 999px; padding: 3px 8px; white-space: nowrap;')}>{it.app}</span>
              </button>
            ))}
            {!results.length ? <div style={css('padding: 20px; text-align: center; color: ' + T.muted + '; font-size: 14px; border: 1.5px dashed ' + T.pillOn + '; border-radius: 12px;')}>No step matches. Try fewer words, or ask {AGENT} to build it.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
