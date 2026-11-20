'use client';
// One rule row (field chip, operator, value, valid check, remove), shared by the trigger's "Only when" filters and the
// condition builder. A rule is a Crit from lib/automations/graph.ts: { field, op, value }.
import { css } from '@/lib/studio/css';
import { FIELDS, OPS, critDone } from '@/lib/automations/graph';
import { T } from '@/lib/workflow/theme';
import { Svg, ICON, PillSelect } from './ui';

// optionsFor(source): the [value, label] choices for a field's source (statuses, channels, people…).
export const newRule = (optionsFor) => ({ field: 'status', op: 'is', value: ((optionsFor('status')[0]) || [''])[0] });

export function RuleRow({ rule, onChange, onRemove, optionsFor, showCheck, removeLabel = 'Remove rule' }) {
  const f = FIELDS.find((x) => x.key === rule.field) || FIELDS[0];
  const needsValue = rule.op === 'is' || rule.op === 'is_not';
  const ok = critDone(rule);
  return (
    <div role="group" aria-label={f.label + ' rule'} style={css('display: flex; gap: 8px; align-items: center; flex-wrap: wrap;')}>
      <PillSelect label="Field" tone="var" value={rule.field} options={FIELDS.map((x) => [x.key, x.label])}
        onChange={(v) => { const nf = FIELDS.find((x) => x.key === v); onChange({ field: v, op: nf.ops[0], value: ((optionsFor(nf.source)[0]) || [''])[0] }); }} />
      <PillSelect label="Rule" value={rule.op} options={f.ops.map((o) => [o, OPS[o]])} onChange={(v) => onChange({ ...rule, op: v, value: v === 'set' || v === 'empty' ? '' : rule.value || ((optionsFor(f.source)[0]) || [''])[0] })} />
      {needsValue ? (
        <select aria-label="Value" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })}
          style={css('flex: 1 1 140px; min-width: 0; height: 44px; border-radius: 12px; background: ' + T.surface + '; border: 1.5px solid ' + T.chipLine + '; color: ' + T.ink + '; padding: 0 12px; font-family: inherit; font-size: 14px;')}>
          <option value="">Choose…</option>
          {optionsFor(f.source).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
        </select>
      ) : <span style={css('flex: 1 1 40px;')} />}
      {showCheck ? (
        <span role="img" aria-label={ok ? 'Rule is complete' : 'Rule needs a value'} style={css('width: 28px; height: 28px; flex: none; border-radius: 999px; background: ' + (ok ? T.liveBg : T.warnBg) + '; color: ' + (ok ? T.live : T.warnInk) + '; display: flex; align-items: center; justify-content: center;')}>
          <Svg d={ok ? ICON.check : ICON.warn} size={14} sw={2.6} />
        </span>
      ) : null}
      <button type="button" className="wf-h" aria-label={removeLabel} onClick={onRemove} style={css('width: 44px; height: 44px; flex: none; border-radius: 12px; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; color: ' + T.muted + '; display: flex; align-items: center; justify-content: center;')}><Svg d={ICON.close} size={14} /></button>
    </div>
  );
}

export function AddRule({ label, onClick }) {
  return (
    <button type="button" className="wf-h" onClick={onClick} style={css('align-self: flex-start; height: 40px; display: flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 999px; background: ' + T.surface + '; border: 1.5px dashed ' + T.borderHover + '; color: ' + T.ink2 + '; font-size: 14px; font-weight: 600;')}><Svg d={ICON.plus} size={13} sw={2.4} />{label}</button>
  );
}
