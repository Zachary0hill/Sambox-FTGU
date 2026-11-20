'use client';
// Trigger setup (handoff Santos-Trigger): what starts the workflow. Three kinds:
//   Event     something changes on the board (the catalog's project triggers), narrowed by "Only when" rules
//   Schedule  a rule in plain words (lib/automations/schedule.ts); the stored rule never shows
//   Webhook   this workflow's own address (app/api/webhooks/automations/[token]), with an optional secret key
// The panel on the right reads the trigger back as a sentence and lists real matches: the workflow's last runs, or
// the projects that fit it right now when it has not run yet.
import { useState } from 'react';
import { css } from '@/lib/studio/css';
import { projectTriggers, triggerById, triggerText } from '@/lib/automations/catalog';
import { matchFilters } from '@/lib/automations/graph';
import { parseRule, ruleString, scheduleText, nextSlots, timeText, DAY_NAMES, DEFAULT_RULE } from '@/lib/automations/schedule';
import { T, FONT } from '@/lib/workflow/theme';
import { TRIGGER_COPY } from '@/lib/workflow/copy';
import { rowValues, rowFitsTrigger } from '@/lib/workflow/graph';
import { Dialog, MiniSeg, Stepper, Switch, KindTile, ICON, btn } from './ui';
import { RuleRow, AddRule, newRule } from './Rules';

const lower = (x) => String(x || '').replace(/^./, (c) => c.toLowerCase());
const token = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const modeOf = (key) => (key === 'schedule' ? 'schedule' : key === 'webhook' ? 'webhook' : 'event');
const when = (ts) => {
  const d = new Date(ts), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return days === 0 ? 'today, ' + t : days === 1 ? 'yesterday' : days === -1 ? 'tomorrow, ' + t : d.toLocaleDateString('en-US', { weekday: days < 0 && days > -7 ? 'long' : undefined, month: 'short', day: 'numeric' }) + (days < 0 ? ', ' + t : '');
};

export default function TriggerModal({ g, name, D, rowId, live, optionsFor, critText, onSave, onClose }) {
  const init = { key: g.trigger.key, value: g.trigger.value, filters: g.trigger.filters || [], tz: g.trigger.tz || '', secret: g.trigger.secret || '' };
  const [t, setT] = useState(init);
  const [base, setBase] = useState(init);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(modeOf(init.key));
  // What each tab last held, so switching tabs and back does not lose it.
  const [mem, setMem] = useState({ [modeOf(init.key)]: init });
  const [copied, setCopied] = useState('');
  const [ping, setPing] = useState(null); // { state: 'busy' | 'ok' | 'bad', rows: [[k, v]] }
  const dirty = JSON.stringify(t) !== JSON.stringify(base);
  const set = (patch) => { setT((x) => ({ ...x, ...patch })); setSaved(false); };
  const wsTz = (D.settings || {}).timezone || 'America/Chicago';

  const pickMode = (m) => {
    if (m === mode) return;
    const keep = { ...mem, [mode]: t };
    const next = keep[m] || (m === 'schedule' ? { key: 'schedule', value: DEFAULT_RULE, filters: [], tz: wsTz, secret: '' }
      : m === 'webhook' ? { key: 'webhook', value: token(), filters: [], tz: '', secret: '' } : { key: '', value: '', filters: [], tz: '', secret: '' });
    setMem(keep); setMode(m); setT(next); setSaved(false); setPing(null);
  };

  // ---------- Event ----------
  const def = triggerById(t.key);
  const vals = def && def.values ? (def.values === 'statuses' ? optionsFor('status') : def.values) : null;
  const pickEvent = (tr) => set({ key: tr.key, value: tr.values === 'statuses' ? ((optionsFor('status')[0]) || [''])[0] : tr.values ? tr.values[0][0] : '' });
  const setFilter = (i, c) => set({ filters: t.filters.map((x, j) => (j === i ? c : x)) });

  // ---------- Schedule ----------
  const rule = parseRule(t.value) || parseRule(DEFAULT_RULE);
  const before = t.key === 'publish_soon';
  const setRule = (patch) => set({ key: 'schedule', value: ruleString({ ...rule, ...patch }), tz: t.tz || wsTz });
  const h12 = (rule.hour + 11) % 12 + 1, pm = rule.hour >= 12;
  const to24 = (h, isPm) => (h % 12) + (isPm ? 12 : 0);
  const freq = before ? 'before' : rule.freq;
  const pickFreq = (f) => {
    if (f === 'before') set({ key: 'publish_soon', value: '2', tz: '' });
    else setRule({ freq: f, days: f === 'weekly' ? (rule.freq === 'weekly' ? rule.days : [new Date().getDay()]) : [] });
  };
  const flipDay = (d) => { const days = rule.days.includes(d) ? rule.days.filter((x) => x !== d) : rule.days.concat([d]); if (days.length) setRule({ freq: 'weekly', days }); };
  const opt = (on) => 'height: 48px; border-radius: 12px; background: ' + (on ? T.varBg : T.surface) + '; border: 1.5px solid ' + (on ? T.ring : T.chipLine) + '; color: ' + T.ink + '; font-size: 15px; font-weight: 600;';

  // ---------- Webhook ----------
  const url = (typeof window === 'undefined' ? '' : window.location.origin) + '/api/webhooks/automations/' + t.value;
  const savedHook = base.key === 'webhook' && base.value === t.value && base.secret === t.secret;
  const copy = async (what, text) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch { setCopied(''); } };
  const sendTest = async () => {
    setPing({ state: 'busy', rows: [] });
    try {
      const res = await fetch(url + '?test=1', { method: 'POST', headers: { 'content-type': 'application/json', ...(t.secret ? { 'x-workflow-key': t.secret } : {}) }, body: '{}' });
      const out = await res.json().catch(() => ({}));
      setPing(res.ok ? { state: 'ok', rows: [['Status', 'Reached'], ['Workflow', out.workflow || name], ['Result', out.message || 'Received.']] }
        : { state: 'bad', rows: [['Status', 'Not reached'], ['Reason', out.error || 'The address did not answer.']] });
    } catch { setPing({ state: 'bad', rows: [['Status', 'Not reached'], ['Reason', 'The request could not be sent.']] }); }
  };

  // ---------- Summary and matches ----------
  const valueLabel = vals && t.value ? (vals.find((x) => x[0] === t.value) || [t.value, t.value])[1] : '';
  const summary = mode === 'schedule' ? (before ? 'When the publishing date is ' + lower(valueLabel || 'coming up') : scheduleText(t.value))
    : mode === 'webhook' ? 'When a request arrives at this workflow’s address'
      : !def ? 'Pick what starts this flow'
        : (t.key === 'publish_soon' ? 'When the publishing date is ' + lower(valueLabel || 'coming up') : 'When ' + lower((TRIGGER_COPY[t.key] || [def.label])[0]) + (valueLabel ? ' and new ' + (def.valueLabel || 'value').toLowerCase() + ' is ' + valueLabel : '')) + t.filters.filter((c) => critText(c)).map((c) => ' and ' + lower(critText(c))).join('');
  const runs = (D.automationRuns || []).filter((r) => r.automation_id === rowId && !r.is_test).slice(0, 3);
  const projects = (D.rows || []).filter((r) => !r.archived);
  const fits = mode === 'event' && def ? projects.filter((r) => rowFitsTrigger(r, t.key, t.value) && matchFilters(t.filters, rowValues(r))) : [];
  const upcoming = mode === 'schedule' && !before ? nextSlots(t.value, t.tz || wsTz) : [];
  const line = (key, text) => <li key={key} style={css('display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid ' + T.line + '; font-size: 15px;')}><span aria-hidden="true" style={css('width: 6px; height: 6px; flex: none; border-radius: 999px; background: ' + T.warn + ';')} /><span style={css('min-width: 0; overflow-wrap: anywhere;')}>{text}</span></li>;
  const h3 = 'font-size: 15px; font-weight: 700;';
  const sub = 'font-size: 13px; font-weight: 600; color: ' + T.muted + ';';
  const incomplete = !t.key || (mode === 'event' && vals && !t.value) || t.filters.some((c) => (c.op === 'is' || c.op === 'is_not') && !c.value);

  const save = async () => {
    const ok = await onSave({ key: t.key, value: t.value, filters: mode === 'event' ? t.filters : [], tz: t.key === 'schedule' ? t.tz || wsTz : '', secret: t.key === 'webhook' ? t.secret : '' });
    if (ok) { setBase(t); setSaved(true); }
  };

  return (
    <Dialog id="wf-trg" eyebrow={'Trigger · ' + name} title="What starts this flow?" width={980} state={dirty ? 'dirty' : saved ? 'saved' : 'clean'} saveLabel="Save trigger" saveOff={incomplete} onSave={save} onClose={onClose}
      headerExtra={<MiniSeg role="tablist" label="Trigger type" h={38} value={mode} onChange={pickMode} options={[['schedule', 'Schedule', ICON.clock], ['event', 'Event', ICON.bolt], ['webhook', 'Webhook', ICON.link]]} />}>
      <div className="wf-two" style={css('display: grid; grid-template-columns: minmax(0, 1fr) 320px; min-height: 480px;')}>
        <div role="tabpanel" aria-label={mode} style={css('padding: 22px 24px; display: flex; flex-direction: column; gap: 22px; min-width: 0;')}>
          {live && dirty ? <p role="status" style={css('margin: 0; padding: 10px 12px; border-radius: 12px; background: ' + T.warnBg + '; color: ' + T.warnInk + '; font-size: 13px; line-height: 1.5;')}>This workflow is live. Saving here applies the change in the builder; press Save in the top bar to update the live automation.</p> : null}

          {mode === 'event' ? (
            <>
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                <div style={css(h3)}>When this happens</div>
                <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 8px;')}>
                  {projectTriggers().map((tr) => {
                    const on = t.key === tr.key;
                    return (
                      <button key={tr.key} type="button" aria-pressed={on} className="wf-li" onClick={() => pickEvent(tr)} style={css('text-align: left; display: flex; gap: 12px; align-items: center; padding: 12px; min-height: 62px; border-radius: 14px; background: ' + (on ? T.varBg : T.surface) + '; border: 1.5px solid ' + (on ? T.ring : T.line) + '; color: ' + T.ink + ';')}>
                        <KindTile kind="trigger" size={30} />
                        <span style={css('display: flex; flex-direction: column; gap: 1px; min-width: 0;')}><span style={css('font-weight: 600; font-size: 14px;')}>{(TRIGGER_COPY[tr.key] || [tr.label])[0]}</span><span style={css('font-size: 13px; color: ' + T.muted + ';')}>{(TRIGGER_COPY[tr.key] || ['', ''])[1]}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {def ? (
                <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                  <div style={css(h3)}>Only when</div>
                  {vals ? (
                    <div role="group" aria-label={'New ' + lower(def.valueLabel || 'value')} style={css('display: flex; gap: 8px; align-items: center; flex-wrap: wrap;')}>
                      <span style={css('height: 44px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; background: ' + T.varBg + '; color: ' + T.varInk + '; font-size: 14px; font-weight: 600; white-space: nowrap;')}>{def.key === 'publish_soon' ? 'Publishing date' : 'New ' + (def.valueLabel || 'value').toLowerCase()}</span>
                      <span style={css('height: 44px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; background: ' + T.surface + '; border: 1px solid ' + T.inputLine + '; font-size: 14px; font-weight: 600;')}>is</span>
                      <select aria-label={def.valueLabel || 'Value'} value={t.value} onChange={(e) => set({ value: e.target.value })} style={css('flex: 1 1 140px; min-width: 0; height: 44px; border-radius: 12px; background: ' + T.surface + '; border: 1.5px solid ' + T.chipLine + '; color: ' + T.ink + '; padding: 0 12px; font-family: inherit; font-size: 14px;')}>
                        {vals.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {t.filters.map((c, i) => <RuleRow key={i} rule={c} optionsFor={optionsFor} removeLabel="Remove filter" onChange={(n) => setFilter(i, n)} onRemove={() => set({ filters: t.filters.filter((_, j) => j !== i) })} />)}
                  <AddRule label="Add a filter" onClick={() => set({ filters: t.filters.concat([newRule(optionsFor)]) })} />
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'schedule' ? (
            <>
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                <div style={css(h3)}>How often</div>
                <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;')}>
                  {[['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['before', 'Before a date']].map((f) => <button key={f[0]} type="button" aria-pressed={freq === f[0]} onClick={() => pickFreq(f[0])} style={css(opt(freq === f[0]))}>{f[1]}</button>)}
                </div>
              </div>
              {before ? (
                <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                  <div style={css(h3)}>Before the publishing date</div>
                  <MiniSeg label="Days before the publishing date" h={38} value={t.value} onChange={(x) => set({ value: x })} options={[['1', '1 day'], ['2', '2 days'], ['3', '3 days'], ['7', '7 days']]} />
                  <p style={css('margin: 0; font-size: 13px; color: ' + T.muted + ';')}>Runs once for each project, that many days before it publishes.</p>
                </div>
              ) : (
                <>
                  {freq === 'weekly' ? (
                    <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                      <div style={css(h3)}>On these days</div>
                      <div style={css('display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px;')}>
                        {DAY_NAMES.map((dn, d) => { const on = rule.days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={dn} onClick={() => flipDay(d)} style={css('height: 48px; border-radius: 999px; background: ' + (on ? T.accent : T.surface) + '; border: 1.5px solid ' + (on ? T.accent : T.chipLine) + '; color: ' + (on ? T.accentInk : T.ink) + '; font-size: 14px; font-weight: 700;')}>{dn.slice(0, 2)}</button>; })}
                      </div>
                    </div>
                  ) : null}
                  <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                    <div style={css(h3)}>At</div>
                    <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
                      <Stepper big width={96} h={48} text={timeText(rule.hour, rule.minute).replace(/ [AP]M$/, '')} lessLabel="Earlier hour" moreLabel="Later hour"
                        onLess={() => setRule({ hour: to24(h12 === 1 ? 12 : h12 - 1, pm) })} onMore={() => setRule({ hour: to24(h12 === 12 ? 1 : h12 + 1, pm) })} />
                      <MiniSeg label="Minutes" h={38} value={String(rule.minute)} onChange={(x) => setRule({ minute: Number(x) })} options={[['0', ':00'], ['15', ':15'], ['30', ':30'], ['45', ':45']]} />
                      <MiniSeg label="AM or PM" h={38} value={pm ? 'pm' : 'am'} onChange={(x) => setRule({ hour: to24(h12, x === 'pm') })} options={[['am', 'AM'], ['pm', 'PM']]} />
                    </div>
                    <p style={css('margin: 0; font-size: 13px; color: ' + T.muted + ';')}>In the workspace’s time ({(t.tz || wsTz).replace(/_/g, ' ')}). A scheduled run has no project, so use steps that do not need one.</p>
                  </div>
                </>
              )}
            </>
          ) : null}

          {mode === 'webhook' ? (
            <>
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                <div style={css(h3)}>Send requests to this address</div>
                <div style={css('display: flex; gap: 8px; align-items: center;')}>
                  <div style={css('flex: 1; min-width: 0; height: 48px; display: flex; align-items: center; padding: 0 14px; border-radius: 12px; background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; font-family: ui-monospace, Menlo, monospace; font-size: 13px; color: ' + T.ink2 + '; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;')}>{url}</div>
                  <button type="button" className="wf-h" onClick={() => copy('url', url)} style={css(btn('ghost', 48) + ' padding: 0 16px;')}>{copied === 'url' ? 'Copied' : 'Copy'}</button>
                </div>
                <p style={css('margin: 0; font-size: 13px; line-height: 1.5; color: ' + T.muted + ';')}>Send a POST with a JSON body. Add a project’s job number as “project” to give project steps something to act on.</p>
              </div>
              <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px;')}>
                <div><div style={css('font-size: 15px; font-weight: 600;')}>Require a secret key</div><div style={css('font-size: 13px; color: ' + T.muted + ';')}>Rejects requests that do not send it</div></div>
                <Switch on={!!t.secret} label="Require a secret key" onChange={(on) => { set({ secret: on ? token(12) : '' }); setPing(null); }} />
              </div>
              {t.secret ? (
                <div style={css('display: flex; gap: 8px; align-items: center;')}>
                  <div style={css('flex: 1; min-width: 0; height: 48px; display: flex; align-items: center; padding: 0 14px; border-radius: 12px; background: ' + T.ground2 + '; border: 1px solid ' + T.line + '; font-size: 13px; color: ' + T.ink2 + ';')}>Send the key in the x-workflow-key header</div>
                  <button type="button" className="wf-h" onClick={() => copy('key', t.secret)} style={css(btn('ghost', 48) + ' padding: 0 16px;')}>{copied === 'key' ? 'Copied' : 'Copy key'}</button>
                </div>
              ) : null}
              <div style={css('border: 1px solid ' + T.line + '; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px;')}>
                <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
                  <span aria-hidden="true" className={ping && ping.state === 'busy' ? 'wf-pulse' : ''} style={css('width: 10px; height: 10px; border-radius: 999px; background: ' + (!ping ? T.pillOn : ping.state === 'ok' ? T.live : ping.state === 'bad' ? T.error : T.varInk) + ';')} />
                  <span aria-live="polite" style={css('font-weight: 600; font-size: 15px;')}>{!savedHook ? 'Save the trigger to switch this address on' : !ping ? 'Ready for a test' : ping.state === 'busy' ? 'Sending…' : ping.state === 'ok' ? 'The address works' : 'The test did not get through'}</span>
                  <span style={css('flex: 1;')} />
                  <button type="button" className="wf-h" disabled={!savedHook || (ping && ping.state === 'busy')} onClick={sendTest} style={css(btn('ghost', 40) + (!savedHook ? ' opacity: .45; cursor: default;' : ''))}>Send a test request</button>
                </div>
                {ping ? ping.rows.map((r) => <div key={r[0]} style={css('display: flex; justify-content: space-between; gap: 12px; padding: 8px 0 0; border-top: 1px solid ' + T.line + '; font-size: 14px;')}><span style={css('color: ' + T.muted + ';')}>{r[0]}</span><span style={css('font-weight: 600; text-align: right;')}>{r[1]}</span></div>) : null}
                <p style={css('margin: 0; font-size: 13px; color: ' + T.muted + ';')}>A test request only checks the address. Nothing runs.</p>
              </div>
            </>
          ) : null}
        </div>

        <aside aria-label="Summary" style={css('padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; background: ' + T.ground + '; border-left: 1px solid ' + T.line + '; min-width: 0;')}>
          <div style={css(sub)}>Summary</div>
          <p aria-live="polite" style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 22px; line-height: 1.2; overflow-wrap: anywhere;')}>{summary}</p>
          {upcoming.length ? (
            <><div style={css(sub + ' margin-top: 8px;')}>Next 3 runs</div><ul style={css('margin: 0; padding: 0; list-style: none;')}>{upcoming.map((ts) => line(ts, when(ts).replace(/^./, (c) => c.toUpperCase())))}</ul></>
          ) : runs.length ? (
            <><div style={css(sub + ' margin-top: 8px;')}>Last {runs.length === 1 ? 'match' : runs.length + ' matches'}</div><ul style={css('margin: 0; padding: 0; list-style: none;')}>{runs.map((r) => line(r.id, (((r.output || {}).project || {}).title || ((r.output || {}).idea || {}).title || triggerText(r.trigger_key || t.key, '')) + ', ' + when(r.created_at)))}</ul></>
          ) : mode === 'event' && def ? (
            <>
              <div style={css(sub + ' margin-top: 8px;')}>{fits.length ? 'Would match now' : 'No matches yet'}</div>
              {fits.length ? <ul style={css('margin: 0; padding: 0; list-style: none;')}>{fits.slice(0, 3).map((r) => line(r.id, r.title + (r.status ? ', ' + r.status : '')))}</ul> : <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: ' + T.muted + ';')}>No project fits this trigger right now. Matches show here once the workflow has run.</p>}
              {fits.length > 3 ? <p style={css('margin: 0; font-size: 13px; color: ' + T.muted + ';')}>And {fits.length - 3} more.</p> : null}
            </>
          ) : mode === 'webhook' ? <p style={css('margin: 0; font-size: 14px; line-height: 1.5; color: ' + T.muted + ';')}>Requests show here once the workflow is live and has run.</p> : null}
        </aside>
      </div>
    </Dialog>
  );
}
