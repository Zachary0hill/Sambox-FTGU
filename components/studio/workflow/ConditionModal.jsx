'use client';
// Condition builder (handoff Santos-Condition): the rules that decide which path of a branch work takes, and the
// paths themselves. Left: "Take the <path> path when", All or Any, the rule rows, Or groups, and a live verdict on
// the newest project. Right: the paths as a small map, with their names, steps and a + to add a step to each.
// Works on a copy of the branch; Save hands the edited branch back to the builder.
import { useState } from 'react';
import { css } from '@/lib/studio/css';
import { matchPath, critDone } from '@/lib/automations/graph';
import { T, KIND, R, SHADOW, dotGrid } from '@/lib/workflow/theme';
import { stepOf, rowValues } from '@/lib/workflow/graph';
import { Dialog, MiniSeg, KindTile, Svg, ICON, btn } from './ui';
import { RuleRow, AddRule, newRule } from './Rules';
import StepFinder from './StepFinder';

const clone = (x) => JSON.parse(JSON.stringify(x));
const wire = (h = 10) => <span aria-hidden="true" style={css('width: 1.5px; height: ' + h + 'px; flex: none; background: ' + T.wire + ';')} />;

export default function ConditionModal({ node, stepNo, pathId, sampleRow, optionsFor, lib, groupLabel, makeNode, onSave, onClose }) {
  const [n, setN] = useState(() => clone(node));
  const [base, setBase] = useState(() => JSON.stringify(node));
  const [saved, setSaved] = useState(false);
  const [finder, setFinder] = useState(null); // the path a step is being added to
  const paths = n.paths || [];
  const lastIdx = paths.length - 1;
  const [cur, setCur] = useState(() => { const i = paths.findIndex((p) => p.id === pathId); return i >= 0 && i < lastIdx ? i : 0; });
  const dirty = JSON.stringify(n) !== base;
  const edit = (fn) => { setN((prev) => { const next = clone(prev); fn(next); return next; }); setSaved(false); };
  const p = paths[cur];
  const editPath = (fn) => edit((x) => fn(x.paths[cur]));
  const twoWay = paths.length === 2;
  const laneName = (i) => (twoWay ? (i === 0 ? 'Yes' : 'No') : i === lastIdx ? 'Otherwise' : 'Path ' + (i + 1));
  const title = n.name || 'Branch';

  // The verdict: which path the newest project would take with the rules as they stand.
  const values = rowValues(sampleRow);
  const allRules = paths.slice(0, lastIdx).flatMap((x) => (x.when || []).concat(...(x.or || [])));
  const complete = paths.slice(0, lastIdx).every((x) => (x.when || []).length) && allRules.every(critDone);
  const took = paths.findIndex((x, i) => i < lastIdx && matchPath(x, values));
  const takes = took >= 0 ? took : lastIdx;
  const first = (x) => (x.steps.length ? stepOf(x.steps[0]).title : 'Continue');

  const group = (rules, setRules, any, setAny, key, onDrop) => (
    <div key={key} style={css('border: 1px solid ' + T.line + '; border-radius: 16px; background: ' + T.ground + '; padding: 14px; display: flex; flex-direction: column; gap: 10px;')}>
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        {setAny ? <MiniSeg label="Match" value={any ? 'any' : 'all'} onChange={(v) => setAny(v === 'any')} options={[['all', 'All'], ['any', 'Any']]} /> : <span style={css('font-size: 13px; font-weight: 700; color: ' + T.sub + ';')}>Or all</span>}
        <span style={css('flex: 1; font-size: 14px; color: ' + T.sub + ';')}>of these match</span>
        {onDrop ? <button type="button" className="wf-h" onClick={onDrop} style={css('height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: ' + T.error + '; font-size: 13px; font-weight: 600;')}>Remove group</button> : null}
      </div>
      {rules.map((c, i) => <RuleRow key={i} rule={c} showCheck optionsFor={optionsFor} onChange={(x) => setRules(rules.map((y, j) => (j === i ? x : y)))} onRemove={() => setRules(rules.filter((_, j) => j !== i))} />)}
      <AddRule label="Add a rule" onClick={() => setRules(rules.concat([newRule(optionsFor)]))} />
    </div>
  );

  const save = async () => { const ok = await onSave(n); if (ok) { setBase(JSON.stringify(n)); setSaved(true); } };

  return (
    <Dialog id="wf-cnd" eyebrow={'Branch · Step ' + stepNo} title={title} width={1180} state={dirty ? 'dirty' : saved ? 'saved' : 'clean'} saveLabel="Save branch" onSave={save} onClose={onClose}>
      <div className="wf-two" style={css('display: grid; grid-template-columns: minmax(0, 1fr) 440px; min-height: 380px;')}>
        <div style={css('padding: 22px 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0;')}>
          <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
            <label htmlFor="wf-cnd-q" style={css('font-size: 13px; font-weight: 600; color: ' + T.muted + ';')}>Question</label>
            <input id="wf-cnd-q" autoComplete="off" value={n.name || ''} onChange={(e) => edit((x) => { x.name = e.target.value; })} placeholder="Sponsored video?" style={css('height: 44px; padding: 0 12px; border-radius: 12px; background: ' + T.surface + '; border: 1.5px solid ' + T.chipLine + '; color: ' + T.ink + '; font-family: inherit; font-size: 15px; font-weight: 600;')} />
          </div>
          {paths.length > 2 ? <MiniSeg label="Path" value={String(cur)} onChange={(v) => setCur(Number(v))} options={paths.slice(0, lastIdx).map((x, i) => [String(i), x.name || laneName(i)])} /> : null}
          <div style={css('font-size: 15px; font-weight: 700;')}>Take the {twoWay ? 'Yes' : p.name || laneName(cur)} path when</div>
          {group(p.when || [], (rules) => editPath((x) => { x.when = rules; }), p.match === 'any', (any) => editPath((x) => { x.match = any ? 'any' : 'all'; }), 'main')}
          {(p.or || []).map((grp, gi) => group(grp, (rules) => editPath((x) => { x.or[gi] = rules; }), false, null, 'or' + gi, () => editPath((x) => { x.or.splice(gi, 1); })))}
          <button type="button" className="wf-h" onClick={() => editPath((x) => { x.or = (x.or || []).concat([[newRule(optionsFor)]]); })} style={css(btn('ghost', 40) + ' align-self: flex-start;')}>Add an Or group</button>

          <div role="status" aria-live="polite" style={css('display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; background: ' + (!sampleRow || !complete ? T.ground2 : T.liveBg) + ';')}>
            <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 999px; background: ' + T.surface + '; color: ' + (!sampleRow || !complete ? T.muted : T.live) + '; display: flex; align-items: center; justify-content: center;')}><Svg d={!sampleRow || !complete ? ICON.warn : ICON.check} size={16} sw={2.6} /></span>
            <span style={css('display: flex; flex-direction: column; gap: 2px; min-width: 0;')}>
              <span style={css('font-size: 15px; font-weight: 700;')}>{!sampleRow ? 'No project to check yet' : !complete ? 'Finish the rules to see the path' : sampleRow.title + ' takes the ' + (twoWay ? laneName(takes) : paths[takes].name) + ' path: ' + (twoWay && paths[takes].name !== laneName(takes) ? paths[takes].name : first(paths[takes]))}</span>
              <span style={css('font-size: 13px; color: ' + T.ink3 + '; overflow-wrap: anywhere;')}>{!sampleRow ? 'The verdict uses the newest project on the board.' : 'Newest project: ' + [sampleRow.title, sampleRow.status, sampleRow.sponsor ? 'sponsored by ' + sampleRow.sponsor : 'no sponsor', sampleRow.type, sampleRow.editor ? 'editor ' + sampleRow.editor : ''].filter(Boolean).join(', ')}</span>
            </span>
          </div>
        </div>

        <aside aria-label="Paths" style={css('padding: 22px 16px 28px; border-left: 1px solid ' + T.line + '; ' + dotGrid + ' display: flex; flex-direction: column; align-items: center; gap: 0; min-width: 0; overflow-x: auto;')}>
          <div style={css('align-self: flex-start; padding: 0 8px 12px; font-size: 13px; font-weight: 600; color: ' + T.muted + ';')}>Paths</div>
          <span style={css('display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 6px; background: ' + T.surface + '; border: 1px solid ' + T.chipLine + '; border-radius: 12px; box-shadow: ' + SHADOW.chip + '; font-size: 14px; font-weight: 600; max-width: 100%;')}><KindTile kind="logic" size={28} /><span style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{title}</span></span>
          {wire(16)}
          <div style={css('display: flex; align-items: flex-start; gap: 12px; padding-top: 0; border-top: 1.5px solid ' + T.wire + '; max-width: 100%;')}>
            {paths.map((x, i) => (
              <div key={x.id} style={css('display: flex; flex-direction: column; align-items: center; width: ' + (paths.length > 2 ? 150 : 190) + 'px; flex: none;')}>
                {wire(14)}
                <span style={css('display: flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; background: ' + (i === 0 ? T.liveBg : T.count) + '; color: ' + (i === 0 ? T.live : T.sub) + '; font-size: 12px; font-weight: 700;')}><Svg d={i === 0 ? ICON.check : ICON.close} size={10} sw={3} />{laneName(i)}</span>
                {wire(8)}
                <input aria-label={'Name of the ' + laneName(i) + ' path'} value={x.name} onChange={(e) => edit((g2) => { g2.paths[i].name = e.target.value; })} placeholder={laneName(i)}
                  style={css('width: 100%; height: 38px; text-align: center; border-radius: 10px; background: ' + T.surface + '; border: 1px dashed ' + T.borderHover + '; color: ' + T.ink + '; font-family: inherit; font-size: 14px; font-weight: 600; padding: 0 8px;')} />
                {x.steps.map((c) => {
                  const v = stepOf(c);
                  return (
                    <span key={c.id} style={css('display: contents;')}>
                      {wire()}
                      <span style={css('display: flex; align-items: center; gap: 8px; width: 100%; height: 34px; padding: 0 8px 0 4px; background: ' + T.surface + '; border: 1px solid ' + T.chipLine + '; border-radius: ' + R.chip + 'px; font-size: 13px; font-weight: 600;')}>
                        <span style={css('width: 24px; height: 24px; flex: none; border-radius: 7px; background: ' + (KIND[v.kind] || KIND.action).bg + '; display: flex; align-items: center; justify-content: center;')}><Svg d={(KIND[v.kind] || KIND.action).icon} size={12} sw={2.2} color={(KIND[v.kind] || KIND.action).ink} /></span>
                        <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{v.title}</span>
                        <button type="button" className="wf-h" aria-label={'Remove ' + v.title + ' from the ' + laneName(i) + ' path'} onClick={() => edit((g2) => { g2.paths[i].steps = g2.paths[i].steps.filter((s) => s.id !== c.id); })} style={css('width: 24px; height: 24px; flex: none; border: 0; border-radius: 7px; background: transparent; color: ' + T.muted + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={11} /></button>
                      </span>
                    </span>
                  );
                })}
                {wire()}
                <button type="button" className="wf-h" aria-label={'Add a step to the ' + laneName(i) + ' path'} onClick={() => setFinder(i)} style={css('width: 34px; height: 34px; flex: none; border-radius: 999px; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; color: ' + T.ink + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.plus} size={14} /></button>
              </div>
            ))}
          </div>
          <p style={css('margin: 18px 8px 0; font-size: 13px; line-height: 1.5; color: ' + T.muted + '; text-align: center;')}>After a path finishes, the flow carries on with the step below the branch.</p>
        </aside>
      </div>
      {finder !== null ? (
        <StepFinder z={80} items={lib} groupLabel={groupLabel} afterTitle={paths[finder].steps.length ? stepOf(paths[finder].steps[paths[finder].steps.length - 1]).title : title} afterKind={paths[finder].steps.length ? stepOf(paths[finder].steps[paths[finder].steps.length - 1]).kind : 'logic'}
          onAdd={(spec) => { const made = makeNode(spec); edit((g2) => { g2.paths[finder].steps.push(made); }); setFinder(null); }} onClose={() => setFinder(null)} />
      ) : null}
    </Dialog>
  );
}
