'use client';

import { useEffect, useState } from 'react';
import { lastSlot, nextSlots } from '@/lib/automations/schedule';
import { css } from '@/lib/studio/css';
import { btn, inputStyle, labelStyle } from './ui';

const endpoint = '/api/automations/production-digest?';
const stack = { display: 'grid', gap: 8, minWidth: 0 };
const note = { margin: 0, color: 'var(--muted)', fontSize: 13 };
const localDate = (ts, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
const localTime = (ts, zone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));

function useRead(query) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetch(endpoint + query, { signal: controller.signal, cache: 'no-store' }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed.');
      if (!controller.signal.aborted) setResult({ query, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ query, error: error.message });
    });
    return () => controller.abort();
  }, [query]);
  return result?.query === query ? result : null;
}

const decoded = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function MessageLine({ line }) {
  if (line.startsWith('*') && line.endsWith('*')) return <strong>{line.slice(1, -1)}</strong>;
  const link = /^• <(https?:\/\/[^|>]+)\|Open> (.*)$/.exec(line);
  return link ? <>• <a href={link[1]}>Open</a> {decoded(link[2])}</> : decoded(line);
}

function WorkdayPreview({ rule, timezone, channel }) {
  const latest = lastSlot(rule, timezone);
  const [date, setDate] = useState(() => latest ? localDate(latest, timezone) : '');
  const [open, setOpen] = useState(false);
  const query = open && date ? new URLSearchParams({ view: 'preview', rule, timezone, date, channel }).toString() : '';
  const result = useRead(query);
  const preview = result?.data;
  return <div style={stack}>
    <label htmlFor="digest-report-date" style={css(labelStyle)}>Reporting date</label>
    <input id="digest-report-date" type="date" style={css(inputStyle)} value={date} max={latest ? localDate(latest, timezone) : undefined} onChange={e => setDate(e.target.value)} />
    <button type="button" style={css(btn('ghost'))} aria-expanded={open} disabled={!date} onClick={() => setOpen(!open)}>{open ? 'Close preview' : 'Preview workday'}</button>
    {open && query && !result && <p role="status" style={note}>Loading workday…</p>}
    {open && result?.error && <p role="alert" style={note}>{result.error}</p>}
    {open && preview && <section aria-label="Workday preview" style={stack}>
      {preview.delivery && <p style={note}>{preview.delivery}</p>}
      {(!preview.historyStart || Date.parse(preview.historyStart) > preview.start) && <p style={note}>{preview.historyStart
        ? 'Edit history starts ' + localTime(preview.historyStart, preview.timezone) + ' (' + preview.timezone + '). Earlier activity may be missing.'
        : 'No recorded edit history is available for this workspace.'}</p>}
      <div aria-label="Outgoing Slack message" style={{ border: '1px solid var(--border-2)', borderRadius: 10, padding: 10, overflowWrap: 'anywhere', display: 'grid', gap: 8 }}>
        {preview.message.blocks.map((block, i) => <div key={i}>{block.text.text.split('\n').map((line,j) => <div key={j}><MessageLine line={line} /></div>)}</div>)}
      </div>
      {preview.groups.map(group => <details key={group.key}><summary>{group.label} ({group.items.length})</summary>
        {group.items.length ? <ul>{group.items.map(row => <li key={row.job}>
          <a href={'/projects?project=' + encodeURIComponent(row.job)}>{row.title}</a> · {row.editor}
          {group.key !== 'completed' && (row.queue_since ? ' · Since ' + localTime(row.queue_since, preview.timezone) : ' · In queue before tracking began')}
        </li>)}</ul> : <p style={note}>No projects.</p>}
      </details>)}
    </section>}
  </div>;
}

export default function DigestInspector({ trigger, workspaceZone, channel, onChange, connected, live }) {
  const timezone = trigger.tz || workspaceZone || 'America/Chicago';
  const rule = trigger.key === 'schedule' ? trigger.value : '';
  let validZone = true;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { validZone = false; }
  const next = validZone ? nextSlots(rule, timezone, 1)[0] : null;
  const [search, setSearch] = useState('');
  const result = useRead(connected ? 'view=channels' : '');
  const channels = result?.data?.channels || [];
  const selected = channels.find(c => c.id === channel);
  const matches = channels.filter(c => c.id === channel || c.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div style={stack}>
    <label htmlFor="digest-search" style={css(labelStyle)}>Search Slack channels</label>
    <input id="digest-search" type="search" style={css(inputStyle)} value={search} onChange={e => setSearch(e.target.value)} disabled={!connected} placeholder="Channel name" />
    <label htmlFor="fb-digest-channel" style={css(labelStyle)}>Destination channel</label>
    <select id="fb-digest-channel" value={channel} onChange={e => onChange(e.target.value)} style={css(inputStyle)}>
      <option value="">Choose a channel</option>
      {channel && !selected && <option value={channel}>{channel} (saved)</option>}
      {matches.map(c => <option key={c.id} value={c.id}>{c.label} · {c.id}</option>)}
    </select>
    {!connected || result?.data?.connected === false ? <p style={note}>Connect Slack to browse joined channels.</p>
      : result?.error ? <p role="alert" style={note}>{result.error}</p>
      : !result ? <p style={note}>Loading joined channels…</p>
      : <>{channel && !selected && <p style={note}>The saved destination is unavailable to this bot. Invite the bot or select another channel.</p>}
        {!matches.some(c => c.label.toLowerCase().includes(search.trim().toLowerCase())) && <p style={note}>No joined channels match this search.</p>}</>}
    {next ? <><p style={note}>{live ? 'Next delivery' : 'Next cutoff if activated'} · {localTime(next, timezone)} ({timezone})</p>
      <WorkdayPreview key={rule + timezone} rule={rule} timezone={timezone} channel={channel} /></> : <p style={note}>{validZone ? 'Choose a schedule to preview a workday and see the next delivery.' : 'Choose a valid timezone in the schedule.'}</p>}
  </div>;
}
