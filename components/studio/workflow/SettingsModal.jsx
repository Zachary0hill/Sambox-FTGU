'use client';
// Workflow settings (handoff Santos-Settings): name, owner, what it does, what happens when a run fails, and run
// limits. The sentence at the top reads the policy back as it changes. The runner honors these per workflow
// (lib/automations/run.ts FlowSettings); a workflow saved before the builder has none and shows the workspace rules
// it runs under today.
import { useState } from 'react';
import { css } from '@/lib/studio/css';
import { T } from '@/lib/workflow/theme';
import { Dialog, MiniSeg, Stepper, Switch, Svg, ICON, labelStyle, inputStyle } from './ui';

// What a workflow with no settings of its own does today: three tries, then the Super Admins and Slack.
export const LEGACY_SETTINGS = { retries: 2, retryWait: '5m', alert: ['admins', 'slack'], autoOffAfter: 0, oneAtATime: false, perHour: 0 };
const WAIT = { '1m': '1 minute', '5m': '5 minutes', '15m': '15 minutes' };
const initials = (n) => String(n || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');

export default function SettingsModal({ g, name, D, slackOn, live, onSave, onClose, goConnectors }) {
  const start = { name, owner: g.owner || '', description: g.description || '', ...LEGACY_SETTINGS, ...(g.settings || {}) };
  const [v, setV] = useState(start);
  const [base, setBase] = useState(start);
  const [saved, setSaved] = useState(false);
  const set = (patch) => { setV((x) => ({ ...x, ...patch })); setSaved(false); };
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const people = (D.members || []).filter((m) => m.status === 'active').map((m) => ({ id: m.user_id, name: (m.person && (m.person.full_name || m.person.name)) || 'Member' }));
  const ownerName = (people.find((p) => p.id === v.owner) || {}).name || '';
  const wsAuto = (D.settings || {}).automation || {};
  const lastSaved = Math.max(1, Number(g.settings && g.settings.autoOffAfter) || 3);

  const who = [v.alert.includes('admins') ? 'the Super Admins' : '', v.alert.includes('owner') && ownerName ? ownerName : '', v.alert.includes('slack') ? 'Slack' : ''].filter(Boolean);
  const retryOff = wsAuto.retry === false;
  const summary = 'If a run fails, it ' + (retryOff || !v.retries ? 'does not retry' : 'retries ' + v.retries + (v.retries === 1 ? ' time' : ' times') + ', ' + WAIT[v.retryWait] + ' apart') +
    (wsAuto.failAlert === false ? ', and alerts no one' : who.length ? ', then alerts ' + list(who) : ', and alerts no one') + '.' +
    (v.autoOffAfter ? ' ' + v.autoOffAfter + ' failures in a row turns the workflow off.' : '');

  const flip = (k) => set({ alert: v.alert.includes(k) ? v.alert.filter((x) => x !== k) : v.alert.concat([k]) });
  const check = (k, title, sub, badge) => {
    const on = v.alert.includes(k);
    return (
      <button key={k} type="button" role="checkbox" aria-checked={on} className="wf-h" onClick={() => flip(k)} style={css('display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: ' + T.surface + '; border: 1.5px solid ' + (on ? T.ring : T.chipLine) + '; color: ' + T.ink + '; text-align: left; min-height: 54px;')}>
        <span style={css('width: 22px; height: 22px; flex: none; border-radius: 7px; border: 1.5px solid ' + (on ? T.accent : T.borderHover) + '; background: ' + (on ? T.accent : T.surface) + '; color: ' + T.accentInk + '; display: flex; align-items: center; justify-content: center;')}>{on ? <Svg d={ICON.check} size={13} sw={3} /> : null}</span>
        <span style={css('flex: 1; display: flex; flex-direction: column; gap: 1px;')}><span style={css('font-weight: 600; font-size: 14px;')}>{title}</span><span style={css('font-size: 13px; color: ' + T.muted + ';')}>{sub}</span></span>
        {badge ? <span style={css('background: ' + T.warnBg + '; color: ' + T.warnInk + '; border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 600;')}>{badge}</span> : null}
      </button>
    );
  };
  const row = (title, sub, control) => (
    <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;')}>
      <div><div style={css('font-size: 15px; font-weight: 600;')}>{title}</div>{sub ? <div style={css('font-size: 13px; color: ' + T.muted + ';')}>{sub}</div> : null}</div>
      {control}
    </div>
  );
  const h2 = 'margin: 0; font-size: 17px; font-weight: 700;';
  const note = (t) => <p role="status" style={css('margin: 0; padding: 10px 12px; border-radius: 12px; background: ' + T.warnBg + '; color: ' + T.warnInk + '; font-size: 13px; line-height: 1.5;')}>{t}</p>;

  const save = async () => {
    const { name: nm, owner, description, ...settings } = v;
    const ok = await onSave({ name: nm.trim() || name, owner, description, settings });
    if (ok) { setBase(v); setSaved(true); }
  };

  return (
    <Dialog id="wf-set" eyebrow={name} title="Workflow settings" width={720} state={dirty ? 'dirty' : saved ? 'saved' : 'clean'} saveLabel="Save settings" onSave={save} onClose={onClose} bodyStyle=" padding: 22px 24px; display: flex; flex-direction: column; gap: 28px;">
      <div aria-live="polite" style={css('background: ' + T.varBg + '; border-radius: 14px; padding: 14px 16px; font-size: 15px; line-height: 1.55; color: ' + T.varInk + ';')}>{summary}</div>
      {live && dirty ? note('This workflow is live. Saving here applies the change in the builder; press Save in the top bar to update the live automation.') : null}

      <section style={css('display: flex; flex-direction: column; gap: 16px;')}>
        <h2 style={css(h2)}>General</h2>
        <label htmlFor="wf-set-name" style={css(labelStyle)}>Name</label>
        <input id="wf-set-name" autoComplete="off" value={v.name} onChange={(e) => set({ name: e.target.value })} style={css(inputStyle + ' font-size: 15px; margin-top: -8px;')} />
        <div id="wf-set-own" style={css(labelStyle)}>Owner</div>
        <div role="radiogroup" aria-labelledby="wf-set-own" style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: -8px;')}>
          {people.map((p) => {
            const on = v.owner === p.id;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => set({ owner: on ? '' : p.id })} style={css('height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px 0 6px; border-radius: 999px; background: ' + (on ? T.varBg : T.surface) + '; border: 1.5px solid ' + (on ? T.ring : T.chipLine) + '; color: ' + T.ink + '; font-size: 14px; font-weight: 600;')}>
                <span aria-hidden="true" style={css('width: 30px; height: 30px; border-radius: 999px; background: ' + T.accent + '; color: ' + T.accentInk + '; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;')}>{initials(p.name)}</span>{p.name}
              </button>
            );
          })}
          {!people.length ? <span style={css('font-size: 13px; color: ' + T.muted + ';')}>No active team members yet.</span> : null}
        </div>
        <label htmlFor="wf-set-desc" style={css(labelStyle)}>What it does</label>
        <textarea id="wf-set-desc" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="One or two lines for the team" style={css(inputStyle + ' margin-top: -8px; padding: 10px 12px; line-height: 1.5; resize: vertical;')} />
      </section>

      <section style={css('display: flex; flex-direction: column; gap: 16px;')}>
        <h2 style={css(h2)}>When a run fails</h2>
        {retryOff ? note('Retry failed runs is off for the whole workspace (Automations > Settings), so no workflow retries until it is back on.') : null}
        {wsAuto.failAlert === false ? note('Alert on failures is off for the whole workspace (Automations > Settings), so nobody is alerted until it is back on.') : null}
        {row('Retry', 'Times the failed step runs again', <Stepper text={v.retries + (v.retries === 1 ? ' time' : ' times')} lessLabel="Fewer retries" moreLabel="More retries" lessOff={v.retries <= 0} moreOff={v.retries >= 5} onLess={() => set({ retries: Math.max(0, v.retries - 1) })} onMore={() => set({ retries: Math.min(5, v.retries + 1) })} />)}
        {row('Wait between tries', '', <MiniSeg label="Wait between tries" value={v.retryWait} onChange={(x) => set({ retryWait: x })} options={[['1m', '1 min'], ['5m', '5 min'], ['15m', '15 min']]} />)}
        <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
          <div><div style={css('font-size: 15px; font-weight: 600;')}>Then alert</div><div style={css('font-size: 13px; color: ' + T.muted + ';')}>Pick one or more</div></div>
          {check('admins', 'Super Admins', 'Inbox notification and email')}
          {check('owner', ownerName || 'Workflow owner', ownerName ? 'Inbox notification and email' : 'Pick an owner above first', ownerName ? '' : 'No owner')}
          {check('slack', 'Slack', 'The connected Slack channel', slackOn ? '' : 'Not connected')}
          {!slackOn ? <button type="button" className="wf-l" onClick={goConnectors} style={css('align-self: flex-start; min-height: 40px; padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; color: ' + T.link + '; text-decoration: underline;')}>Connect Slack in Connectors</button> : null}
        </div>
        {row('Auto-pause', v.autoOffAfter ? 'Turns off after ' + v.autoOffAfter + ' failures in a row' : 'Keeps running however often it fails', (
          <div style={css('display: flex; align-items: center; gap: 10px;')}>
            {v.autoOffAfter ? <Stepper text={String(v.autoOffAfter)} width={30} h={38} lessLabel="Fewer failures" moreLabel="More failures" lessOff={v.autoOffAfter <= 1} moreOff={v.autoOffAfter >= 10} onLess={() => set({ autoOffAfter: Math.max(1, v.autoOffAfter - 1) })} onMore={() => set({ autoOffAfter: Math.min(10, v.autoOffAfter + 1) })} /> : null}
            <Switch on={!!v.autoOffAfter} label="Auto-pause" onChange={(on) => set({ autoOffAfter: on ? lastSaved : 0 })} />
          </div>
        ))}
      </section>

      <section style={css('display: flex; flex-direction: column; gap: 16px;')}>
        <h2 style={css(h2)}>Run limits</h2>
        {row('One run at a time', 'New runs wait in line while one runs', <Switch on={!!v.oneAtATime} label="One run at a time" onChange={(on) => set({ oneAtATime: on })} />)}
        {row('Most runs per hour', '', <MiniSeg label="Most runs per hour" value={String(v.perHour || 0)} onChange={(x) => set({ perHour: Number(x) })} options={[['10', '10'], ['25', '25'], ['50', '50'], ['0', 'No limit']]} />)}
      </section>
    </Dialog>
  );
}
