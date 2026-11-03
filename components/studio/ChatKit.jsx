'use client';
// app: Daily assistant chat parts, hand written (not from the design canvas): reply text with light markdown, the
// collapsible Thinking block, tool steps, reply actions, the composer's model picker and Fast / Think toggle, and the
// AI settings dialog behind the gear in the Daily header. Styles use the board's tokens through css().
import { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { btnStyle, fieldLabelStyle } from '@/lib/studio/prims';
import { Field, Icon } from './Prims';
import Dropdown from './Dropdown';

const ICON = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };
const P = {
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  brain: 'M9.5 2A2.5 2.5 0 0 0 7 4.5v.3A3 3 0 0 0 4.5 8 3 3 0 0 0 3 10.6 3.5 3.5 0 0 0 5 17a3 3 0 0 0 4.5 2.6V2zM14.5 2A2.5 2.5 0 0 1 17 4.5v.3A3 3 0 0 1 19.5 8a3 3 0 0 1 1.5 2.6A3.5 3.5 0 0 1 19 17a3 3 0 0 1-4.5 2.6V2z',
  chev: 'M6 9l6 6 6-6',
  check: 'M20 6 9 17l-5-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  redo: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  x: 'M18 6 6 18M6 6l12 12',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.2A10 10 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A16 16 0 0 0 2 12s3 7 10 7a10 10 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  spin: 'M21 12a9 9 0 1 1-6.2-8.6',
  out: 'M7 17 17 7M8 7h9v9',
};
const Ico = ({ d, size = 16, style }) => <svg {...ICON} width={size} height={size} style={style}><path d={d}></path></svg>;
const DOT = { anthropic: '#D97757', openai: '#10A37F', gemini: '#4285F4' };

// ---------- Reply text ----------
// Light markdown to React nodes: paragraphs, headings, lists, quotes, code blocks, tables, bold, italic, inline code
// and links. Nothing from the model is inserted as HTML; links open only http(s) URLs.
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|((?:^|(?<=[\s(]))[*_][^*_\s][^*_\n]*?[*_](?=[\s.,;:!?)]|$))/g;
function inline(text, key) {
  const out = [];
  let last = 0, m, n = 0;
  const s = String(text);
  // A fresh regex per call: bold recurses into inline(), and a shared lastIndex would loop forever.
  const re = new RegExp(INLINE.source, 'g');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const k = key + '-' + n++;
    if (m[1]) out.push(<code key={k} style={css('padding: 1px 6px; border-radius: 6px; background: var(--chip-2); font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 0.9em; color: var(--ink)')}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k} style={css('font-weight: 650; color: var(--ink)')}>{inline(m[2].slice(2, -2), k)}</strong>);
    else if (m[3]) { const i = m[3].indexOf(']('); out.push(<a key={k} href={m[3].slice(i + 2, -1)} target="_blank" rel="noopener noreferrer" style={css('color: var(--ink); text-decoration: underline; text-underline-offset: 2px')}>{m[3].slice(1, i)}</a>); }
    else if (m[4]) out.push(<a key={k} href={m[4]} target="_blank" rel="noopener noreferrer" style={css('color: var(--ink); text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere')}>{m[4]}</a>);
    else if (m[5]) out.push(<em key={k}>{m[5].slice(1, -1)}</em>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function parse(text) {
  const blocks = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let para = [], list = null, i = 0;
  const endPara = () => { if (para.length) blocks.push({ t: 'p', text: para.join('\n') }); para = []; };
  const endList = () => { if (list) blocks.push(list); list = null; };
  while (i < lines.length) {
    const raw = lines[i], line = raw.trim();
    if (/^```/.test(line)) {
      endPara(); endList();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      blocks.push({ t: 'code', text: code.join('\n') });
      i++;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      endPara(); endList();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const r = lines[i].trim();
        if (!/^\|?[\s:|-]+\|[\s:|-]*$/.test(r)) rows.push(r.slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      blocks.push({ t: 'table', rows });
      continue;
    }
    i++;
    if (!line) { endPara(); endList(); continue; }
    if (/^[-*_]{3,}$/.test(line)) { endPara(); endList(); blocks.push({ t: 'hr' }); continue; }
    const b = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (b) {
      endPara();
      const ord = /\d/.test(b[1]);
      if (!list || list.ord !== ord) { endList(); list = { t: 'list', ord, start: ord ? parseInt(b[1], 10) || 1 : 1, items: [] }; }
      list.items.push({ text: b[2], sub: /^\s{2,}/.test(raw) });
      continue;
    }
    if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1].text += ' ' + line; continue; }
    endList();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { endPara(); blocks.push({ t: 'h', level: h[1].length, text: h[2] }); continue; }
    if (/^>\s?/.test(line)) { endPara(); blocks.push({ t: 'quote', text: line.replace(/^>\s?/, '') }); continue; }
    para.push(line);
  }
  endPara(); endList();
  return blocks;
}

const CARET = <span aria-hidden="true" className="fb-caret" style={css('display: inline-block; width: 7px; height: 1.05em; margin-left: 2px; vertical-align: -0.15em; border-radius: 2px; background: var(--ink)')}></span>;

export function RichText({ text, live }) {
  const blocks = useMemo(() => parse(text), [text]);
  const T = 'margin: 0; font-size: 15px; line-height: 1.65; color: var(--ink-2); overflow-wrap: anywhere;';
  const lastIdx = blocks.length - 1;
  const caret = (i) => (live && i === lastIdx ? CARET : null);
  return (
    <div className="fb-rich" style={css('display: flex; flex-direction: column; gap: 12px; min-width: 0')}>
      {blocks.map((b, i) => {
        const k = 'b' + i;
        if (b.t === 'p') return <p key={k} style={css(T + ' white-space: pre-line;')}>{inline(b.text, k)}{caret(i)}</p>;
        if (b.t === 'h') return <p key={k} role="heading" aria-level={Math.min(6, b.level + 2)} style={css('margin: 4px 0 0; font-size: ' + (b.level <= 2 ? '17px' : '15px') + '; font-weight: 700; line-height: 1.4; color: var(--ink);')}>{inline(b.text, k)}{caret(i)}</p>;
        if (b.t === 'quote') return <p key={k} style={css(T + ' padding-left: 12px; border-left: 3px solid var(--line-3); color: var(--muted);')}>{inline(b.text, k)}{caret(i)}</p>;
        if (b.t === 'hr') return <hr key={k} style={css('width: 100%; margin: 4px 0; border: 0; border-top: 1px solid var(--line-3)')} />;
        if (b.t === 'code') return (
          <pre key={k} style={css('margin: 0; padding: 12px 14px; border-radius: 12px; background: var(--chip); border: 1px solid var(--line-3); overflow-x: auto; font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 13px; line-height: 1.55; color: var(--ink)')}><code>{b.text}</code>{caret(i)}</pre>
        );
        if (b.t === 'table') return (
          <div key={k} style={css('overflow-x: auto; border: 1px solid var(--line-3); border-radius: 12px')}>
            <table style={css('width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.45; color: var(--ink-2)')}>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri} style={css(ri ? 'border-top: 1px solid var(--line-3)' : 'background: var(--chip)')}>
                    {r.map((c, ci) => (ri ? <td key={ci} style={css('padding: 8px 12px; vertical-align: top')}>{inline(c, k + ri + ci)}</td> : <th key={ci} scope="col" style={css('padding: 8px 12px; text-align: left; font-weight: 600; color: var(--ink)')}>{inline(c, k + ri + ci)}</th>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        const L = b.ord ? 'ol' : 'ul';
        return (
          <L key={k} start={b.ord ? b.start : undefined} style={css(T + ' padding: 0 0 0 22px; display: flex; flex-direction: column; gap: 6px; list-style-type: ' + (b.ord ? 'decimal' : 'disc') + ';')}>
            {b.items.map((it, j) => <li key={j} style={css(it.sub ? 'margin-left: 18px; list-style-type: circle' : '')}>{inline(it.text, k + '-' + j)}{live && i === lastIdx && j === b.items.length - 1 ? CARET : null}</li>)}
          </L>
        );
      })}
      {live && !blocks.length ? <p style={css(T)}>{CARET}</p> : null}
    </div>
  );
}

// ---------- Thinking ----------
// t: { text, live, ms, startedAt }. While the model reasons the block is open and shows the reasoning as it streams;
// once the answer starts it folds to "Thought for Ns" and opens on click.
export function Thinking({ t }) {
  const [open, setOpen] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const bodyRef = useRef(null);
  useEffect(() => {
    if (!t.live) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t.live]);
  useEffect(() => { if (t.live && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [t.text, t.live]);
  const shown = open == null ? !!t.live : open;
  const secs = t.live ? Math.max(0, Math.round((now - (t.startedAt || now)) / 1000)) : Math.max(1, Math.round((t.ms || 0) / 1000));
  const label = t.live ? 'Thinking' : 'Thought for ' + secs + (secs === 1 ? ' second' : ' seconds');
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px; min-width: 0')}>
      <button type="button" aria-expanded={shown ? 'true' : 'false'} onClick={() => setOpen(!shown)} className="fb-ni" style={css('align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 10px 0 8px; margin-left: -8px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--muted)')}>
        <Ico d={P.brain} size={15} />
        <span className={t.live ? 'fb-shimmer' : undefined}>{label}</span>
        {t.live && secs ? <span style={css('font-weight: 500; color: var(--muted-2); font-variant-numeric: tabular-nums')}>{secs}s</span> : null}
        <Ico d={P.chev} size={14} style={css('transition: transform .15s ease; transform: rotate(' + (shown ? '180' : '0') + 'deg)')} />
      </button>
      {shown && t.text ? (
        <div ref={bodyRef} style={css('max-height: ' + (t.live ? '180px' : '420px') + '; overflow-y: auto; padding: 2px 0 2px 14px; border-left: 2px solid var(--line-3); font-size: 13px; line-height: 1.6; color: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere')}>{t.text.trim()}</div>
      ) : null}
    </div>
  );
}

// ---------- Tool steps ----------
export function Steps({ steps }) {
  if (!steps || !steps.length) return null;
  return (
    <ul aria-label="Steps" style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px')}>
      {steps.map((st, i) => (
        <li key={i} style={css('display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border-radius: 999px; background: var(--chip); font-size: 12px; font-weight: 600; color: ' + (st.done ? 'var(--muted)' : 'var(--ink-3)'))}>
          {st.done ? <Ico d={P.check} size={12} /> : <span aria-hidden="true" className="fb-spin" style={css('width: 11px; height: 11px; box-sizing: border-box; border-radius: 999px; border: 2px solid var(--line-3); border-top-color: var(--ink-3)')}></span>}
          {st.label}
        </li>
      ))}
    </ul>
  );
}

// ---------- Reply actions ----------
// a: { text, regenerate?, info }
export function MsgActions({ a }) {
  const [copied, setCopied] = useState(false);
  const B = 'width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(a.text || '').then(done, () => {});
  };
  return (
    <div className="fb-msgact" style={css('display: flex; align-items: center; gap: 2px; margin: -4px 0 0 -6px')}>
      <button type="button" className="fb-ni" aria-label={copied ? 'Copied' : 'Copy reply'} title={copied ? 'Copied' : 'Copy'} onClick={copy} style={css(B)}><Ico d={copied ? P.check : P.copy} size={15} /></button>
      {a.regenerate ? <button type="button" className="fb-ni" aria-label="Regenerate reply" title="Regenerate" onClick={a.regenerate} style={css(B)}><Ico d={P.redo} size={15} /></button> : null}
      {a.info ? <span style={css('margin-left: 6px; font-size: 12px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{a.info}</span> : null}
    </div>
  );
}

// ---------- Conversation scroll ----------
// Keeps the newest text in view while it streams, unless the member scrolled up to read. Opening another chat
// (chatKey) jumps to its end.
export function ChatScroll({ chatKey, style, children }) {
  const ref = useRef(null);
  const pinned = useRef(true);
  useEffect(() => { pinned.current = true; }, [chatKey]);
  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });
  const onScroll = () => {
    const el = ref.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  return <div ref={ref} onScroll={onScroll} style={style}>{children}</div>;
}

// ---------- Composer: model picker and Fast / Think ----------
const modelCache = {};

// p: { providers: [{id, name, model}], provider, model, pick(provider, model), admin, listModels(provider), scope }
export function ModelPicker({ p }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [lists, setLists] = useState(modelCache);
  const cur = p.providers.find((x) => x.id === p.provider) || p.providers[0];
  // Super Admins see every model the saved key can use, listed once per page load.
  const toggle = () => {
    setOpen(!open); setQ('');
    if (open || !p.admin) return;
    p.providers.forEach((pr) => {
      if (modelCache[pr.id]) return;
      modelCache[pr.id] = 'loading';
      p.listModels(pr.id).then((ms) => { modelCache[pr.id] = ms.map((x) => x.id); setLists({ ...modelCache }); })
        .catch(() => { modelCache[pr.id] = null; setLists({ ...modelCache }); });
    });
    setLists({ ...modelCache });
  };
  if (!cur) return <span title={p.scopeTitle} style={css('display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; background: var(--chip); font-size: 13px; font-weight: 600; color: var(--ink-3); white-space: nowrap')}>{p.scope}</span>;
  const needle = q.trim().toLowerCase();
  const groups = p.providers.map((pr) => {
    const l = Array.isArray(lists[pr.id]) ? lists[pr.id] : [];
    const ids = [pr.model].concat(l.filter((x) => x !== pr.model));
    return { pr, loading: lists[pr.id] === 'loading', ids: ids.filter((x) => !needle || x.toLowerCase().includes(needle) || pr.name.toLowerCase().includes(needle)) };
  });
  const many = groups.reduce((n, g) => n + g.ids.length, 0) > 8;
  return (
    <div style={css('position: relative; min-width: 0')}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open ? 'true' : 'false'} title={p.scopeTitle} onClick={toggle} style={css('display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 32px; padding: 0 10px 0 12px; border: 0; border-radius: 999px; background: var(--chip); font-size: 13px; font-weight: 600; color: var(--ink-3); cursor: pointer; white-space: nowrap')}>
        <span aria-hidden="true" style={css('width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + (DOT[cur.id] || 'var(--muted)'))}></span>
        <span style={css('overflow: hidden; text-overflow: ellipsis')}>{cur.name + ' ' + (p.model || cur.model)}</span>
        <Ico d={P.chev} size={14} style={css('flex: none; color: var(--muted-2)')} />
      </button>
      {open ? (
        <>
          <button type="button" tabIndex={-1} aria-label="Close model list" onClick={() => setOpen(false)} style={css('position: fixed; inset: 0; z-index: 30; border: 0; background: transparent; cursor: default')}></button>
          <div role="listbox" aria-label="Model" className="fb-pop" style={css('position: absolute; z-index: 31; left: 0; bottom: calc(100% + 8px); width: 300px; max-width: calc(100vw - 48px); max-height: min(380px, 60vh); overflow-y: auto; box-sizing: border-box; padding: 6px; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface); box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.16)')}>
            {many ? (
              <div style={css('position: sticky; top: -6px; display: flex; align-items: center; gap: 8px; margin: -6px -6px 4px; padding: 10px 12px; background: var(--surface); border-bottom: 1px solid var(--line-3); color: var(--muted-2)')}>
                <Ico d={P.search} size={14} />
                <input autoFocus type="text" aria-label="Search models" placeholder="Search models" value={q} onChange={(e) => setQ(e.target.value)} style={css('flex: 1; min-width: 0; border: 0; background: transparent; font-size: 13px; color: var(--ink); outline: none')} />
              </div>
            ) : null}
            {groups.map((g) => (
              <div key={g.pr.id} role="group" aria-label={g.pr.name}>
                <p style={css('margin: 0; padding: 8px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-2)')}>{g.pr.name}{g.loading ? ' · loading' : ''}</p>
                {g.ids.map((id) => {
                  const sel = g.pr.id === cur.id && id === (p.model || cur.model);
                  return (
                    <button key={id} type="button" role="option" aria-selected={sel ? 'true' : 'false'} className="mitem" onClick={() => { p.pick(g.pr.id, id); setOpen(false); }} style={css('display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 10px; text-align: left; cursor: pointer; font-size: 13px; color: var(--ink); background: ' + (sel ? 'var(--chip-2)' : 'transparent'))}>
                      <span aria-hidden="true" style={css('width: 8px; height: 8px; flex: none; border-radius: 999px; background: ' + (DOT[g.pr.id] || 'var(--muted)'))}></span>
                      <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{id}</span>
                      {id === g.pr.model ? <span style={css('font-size: 11px; font-weight: 600; color: var(--muted-2)')}>Default</span> : null}
                      {sel ? <Ico d={P.check} size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            {!p.admin ? <p style={css('margin: 4px 0 0; padding: 8px 10px; border-top: 1px solid var(--line-3); font-size: 12px; line-height: 1.4; color: var(--muted-2)')}>A Super Admin can connect more models in AI settings.</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// m: { mode: 'fast' | 'think', set(mode) }
export function ModeToggle({ m }) {
  const opt = (id, label, d, tip) => {
    const on = m.mode === id;
    return (
      <button type="button" role="radio" aria-checked={on ? 'true' : 'false'} title={tip} onClick={() => m.set(id)} style={css('display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 0 10px; border: 0; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06);' : 'background: transparent; color: var(--muted);'))}>
        <Ico d={d} size={13} />{label}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Answer mode" style={css('flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: 999px; background: var(--chip)')}>
      {opt('fast', 'Fast', P.bolt, 'Fast: answers right away with minimal reasoning')}
      {opt('think', 'Think', P.brain, 'Think: reasons through the question first and shows its thinking')}
    </div>
  );
}

export function GearButton({ onClick }) {
  return (
    <button type="button" className="fb-ni" aria-label="AI settings" title="AI settings" onClick={onClick} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}>
      <Ico d={P.gear} size={18} />
    </button>
  );
}

// ---------- AI settings dialog ----------
// d: { close, A, onChanged(), mode, setMode(mode) }. Reads /api/assistant/settings; keys and models save through the
// Integrations actions (the server checks each key with a live call before storing it in Vault). Laid out like the
// Edit brand dialog: one pane per job, with a save bar that appears only when the workspace defaults have changed.
const MAX_INSTRUCTIONS = 4000;
const HINT = 'margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted-2);';
const SMALL_BTN = 'display: inline-flex; align-items: center; gap: 6px; flex: none; height: 36px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; letter-spacing: normal; white-space: nowrap; cursor: pointer;';
const OFF_BTN = ' background: var(--chip); color: var(--faint); cursor: default;';
const MODES = [
  { id: 'fast', label: 'Fast', d: P.bolt, note: 'Starts writing right away.' },
  { id: 'think', label: 'Think', d: P.brain, note: 'Reasons first and shows its thinking.' },
];
const PANE_ICON = {
  chat: 'M2.5 3.5h11V11h-6l-3 2.5V11h-2z',
  workspace: 'M3 5h10M3 11h10M6 3.5v3M10 9.5v3',
  models: 'M10 2.5a3.5 3.5 0 1 1-3.2 4.9L2.5 11.7v1.8h2V12H6v-1.5h1.5l1-1',
};

const ProviderDot = ({ id, size = 8 }) => <span aria-hidden="true" style={css('width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: 999px; background: ' + (DOT[id] || 'var(--muted)'))}></span>;
const Spinner = ({ size = 14 }) => <span className="fb-spin" aria-hidden="true" style={css('display: inline-flex; flex: none')}><Ico d={P.spin} size={size} /></span>;

function PaneHead({ id, title, help }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 4px')}>
      <h3 id={id} style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h5); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink)')}>{title}</h3>
      {help ? <p style={css(HINT + ' font-size: 13px;')}>{help}</p> : null}
    </div>
  );
}

// Fast / Think as two radio cards, so each choice explains itself. Arrow keys move between them.
function ModeCards({ label, caption, value, onChange, disabled }) {
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = MODES.findIndex((m) => m.id !== value);
    onChange(MODES[next].id);
    const btns = e.currentTarget.querySelectorAll('button');
    if (btns[next]) btns[next].focus();
  };
  return (
    <div style={css('display: flex; flex-direction: column; gap: 6px')}>
      {caption ? <span style={css(fieldLabelStyle)}>{caption}</span> : null}
      <div role="radiogroup" aria-label={label} onKeyDown={disabled ? undefined : onKey} style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 8px')}>
        {MODES.map((m) => {
          const on = value === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} tabIndex={on ? 0 : -1} disabled={disabled} className={on ? undefined : 'fb-dd'} onClick={() => onChange(m.id)}
              style={css('display: flex; align-items: flex-start; gap: 10px; box-sizing: border-box; min-width: 0; padding: 12px; border: 1px solid ' + (on ? 'var(--ink)' : 'var(--border)') + '; border-radius: 12px; text-align: left; letter-spacing: normal; cursor: ' + (disabled ? 'default' : 'pointer') + '; ' + (on ? 'background: var(--surface); box-shadow: inset 0 0 0 1px var(--ink);' : 'background: var(--panel);') + (disabled ? ' opacity: 0.6;' : ''))}>
              <span style={css('display: inline-flex; flex: none; margin-top: 2px; color: ' + (on ? 'var(--ink)' : 'var(--muted-2)'))}><Ico d={m.d} /></span>
              <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}>
                <span style={css('font-size: 14px; font-weight: 600; color: var(--ink)')}>{m.label}</span>
                <span style={css('font-size: 12px; font-weight: 400; line-height: 1.4; color: var(--muted-2)')}>{m.note}</span>
              </span>
              {on ? <span style={css('display: inline-flex; flex: none; margin-top: 2px; color: var(--ink)')}><Ico d={P.check} size={14} /></span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KeyLink({ pr }) {
  return pr.keyUrl ? (
    <a href={pr.keyUrl} target="_blank" rel="noopener noreferrer" className="fb-mr" style={css(SMALL_BTN + ' text-decoration: none;')}>
      Get a key<Ico d={P.out} size={13} />
    </a>
  ) : null;
}

function ProviderCard({ pr, admin, isDefault, A, after, onDirty }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [models, setModels] = useState(null);
  const [model, setModel] = useState(pr.model);
  const auto = admin && pr.connected;
  const [busy, setBusy] = useState(auto ? 'models' : '');
  const [err, setErr] = useState('');
  const fetchModels = (k) => A.listModels(pr.id, k || '').then((ms) => { setModels(ms.map((x) => x.id)); setBusy(''); }).catch((e) => { setErr(e.message || 'Could not list models.'); setBusy(''); });
  const load = (k) => { setBusy('models'); setErr(''); fetchModels(k); };
  // The saved key's models fill the dropdown when the dialog opens (the card remounts when the saved model changes).
  useEffect(() => { if (auto) fetchModels(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!key.trim() || model !== pr.model;
  useEffect(() => { onDirty(pr.id, dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy('save'); setErr('');
    const ok = await A.saveIntegration({ provider: pr.id, name: pr.name }, Object.assign({ model }, key.trim() ? { apiKey: key.trim() } : {}));
    setBusy('');
    if (ok) { setKey(''); setReplacing(false); after(); } else setErr('Not saved. Check the key and model.');
  };
  const drop = async () => { setBusy('drop'); await A.disconnectIntegration({ provider: pr.id, name: pr.name }); setBusy(''); setConfirming(false); after(); };
  const reset = () => { setKey(''); setModel(pr.model); setReplacing(false); setShow(false); setErr(''); };
  const ids = models ? [pr.model].concat(models.filter((x) => x !== pr.model)) : [pr.model];
  if (!ids.includes(model)) ids.push(model);
  const options = ids.map((id) => ({ value: id, label: id, note: id === pr.model && pr.connected ? 'Current' : '' }));
  const modelField = (
    <Dropdown label="Default model" value={model} options={options} onChange={setModel} searchable={options.length > 7} searchLabel="Search models" disabled={busy === 'save' || busy === 'drop'}
      display={busy === 'models' ? { label: model, note: 'Loading models…' } : { label: model }} />
  );
  const keyField = (
    <Field label={pr.connected ? 'New API key' : 'API key'} type={show ? 'text' : 'password'} mono autoComplete="off" spellCheck="false" autoFocus={replacing} placeholder="Paste the API key" value={key}
      disabled={busy === 'save'} onChange={(e) => setKey(e.target.value)} onBlur={() => { if (key.trim() && !pr.connected) load(key.trim()); }}
      suffix={<button type="button" className="fb-ni" aria-label={show ? 'Hide key' : 'Show key'} aria-pressed={show} onClick={() => setShow(!show)} style={css('width: 28px; height: 28px; margin-right: -6px; border: 0; border-radius: 8px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Ico d={show ? P.eyeOff : P.eye} size={15} /></button>} />
  );
  return (
    <section aria-label={pr.name} style={css('display: flex; flex-direction: column; gap: 14px; padding: 16px; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface)')}>
      <div style={css('display: flex; align-items: center; gap: 12px')}>
        <span aria-hidden="true" style={css('width: 36px; height: 36px; flex: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, ' + (DOT[pr.id] || 'var(--muted)') + ' 14%, transparent)')}><ProviderDot id={pr.id} size={12} /></span>
        <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px')}>
          <span style={css('display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--ink)')}>
            {pr.name}
            {isDefault ? <span style={css('display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; font-size: 11px; font-weight: 600; background: var(--inv); color: var(--inv-ink)')}>Default</span> : null}
          </span>
          <span style={css('display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: ' + (pr.connected ? 'var(--green-ink, #0B7A5F)' : 'var(--muted-2)'))}>
            <span aria-hidden="true" style={css('width: 6px; height: 6px; flex: none; border-radius: 999px; background: ' + (pr.connected ? 'currentColor' : 'var(--border-strong)'))}></span>
            {pr.connected ? 'Connected' : 'Not connected'}
            {pr.connected && pr.keyHint ? <span style={css('font-family: ui-monospace, Menlo, monospace; color: var(--muted-2)')}>••••{pr.keyHint}</span> : null}
          </span>
        </div>
        {admin && !pr.connected ? <KeyLink pr={pr} /> : null}
      </div>
      {pr.error ? <p role="alert" style={css('margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; line-height: 1.4')}>{pr.error}</p> : null}
      {!admin ? (
        <p style={css('margin: 0; font-size: 13px; color: var(--muted)')}>{pr.connected ? 'Default model: ' + pr.model : 'A Super Admin can connect this provider.'}</p>
      ) : (
        <>
          {pr.connected ? modelField : (
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px')}>{keyField}{modelField}</div>
          )}
          {pr.connected && replacing ? keyField : null}
          {err ? <p role="alert" style={css('margin: 0; font-size: 13px; font-weight: 600; color: var(--red-ink)')}>{err}</p> : null}
          {confirming ? (
            <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line)')}>
              <p role="alert" style={css('flex: 1 1 220px; margin: 0; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--red-ink)')}>Disconnect {pr.name}? Its saved key is deleted.</p>
              <button type="button" className="fb-mr" disabled={busy === 'drop'} onClick={() => setConfirming(false)} style={css(SMALL_BTN)}>Keep</button>
              <button type="button" disabled={busy === 'drop'} onClick={drop} style={css(SMALL_BTN + ' padding: 0 12px; background: var(--red-soft); color: var(--red-ink);')}>{busy === 'drop' ? <Spinner /> : null}{busy === 'drop' ? 'Disconnecting…' : 'Disconnect'}</button>
            </div>
          ) : (
            <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 4px; ' + (pr.connected ? 'margin: -2px 0 -4px -10px;' : ''))}>
              {pr.connected && !replacing ? <button type="button" className="fb-mr" onClick={() => setReplacing(true)} style={css(SMALL_BTN)}>Replace key</button> : null}
              {pr.connected && replacing ? <KeyLink pr={pr} /> : null}
              {pr.connected && !models && busy !== 'models' ? <button type="button" className="fb-mr" disabled={!!busy} onClick={() => load('')} style={css(SMALL_BTN)}>Load models</button> : null}
              {pr.connected ? <button type="button" className="fb-mr" disabled={!!busy} onClick={() => setConfirming(true)} style={css(SMALL_BTN + ' color: var(--red-ink);')}>Disconnect</button> : null}
              <span style={css('flex: 1')}></span>
              {pr.connected && (dirty || replacing) ? <button type="button" className="fb-mr" disabled={busy === 'save'} onClick={reset} style={css(SMALL_BTN)}>Cancel</button> : null}
              {!pr.connected || dirty ? (
                <button type="button" onClick={save} disabled={!!busy || !dirty || (!pr.connected && !key.trim())} style={css(btnStyle('primary', { h: 36 }) + ' font-size: 13px; letter-spacing: normal;' + ((!pr.connected && !key.trim()) ? OFF_BTN : ''))}>
                  {busy === 'save' ? <Spinner /> : null}
                  {busy === 'save' ? (key.trim() ? 'Checking key…' : 'Saving…') : pr.connected ? 'Save' : 'Connect'}
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AiSettings({ d }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('fast');
  const [ins, setIns] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pane, setPane] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [cards, setCards] = useState({});
  const dialog = useRef(null);
  const load = () => fetch('/api/assistant/settings', { cache: 'no-store' }).then((r) => r.json().then((j) => {
    if (!r.ok) throw new Error(j.error || 'Could not load AI settings.');
    setSt(j); setMode(j.mode); setIns(j.instructions || ''); setErr('');
  })).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  // Focus moves into the dialog and returns to the gear on close.
  useEffect(() => {
    const back = document.activeElement;
    if (dialog.current) dialog.current.focus({ preventScroll: true });
    return () => { if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); };
  }, []);
  const after = () => { load(); d.onChanged(); };
  const put = async (body) => {
    setBusy(true); setErr('');
    const r = await fetch('/api/assistant/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setErr(j.error || 'Could not save AI settings.'); return false; }
    return true;
  };
  const savePrefs = async () => { if (await put({ mode, instructions: ins })) { setSaved(true); setLeaving(false); setTimeout(() => setSaved(false), 1800); after(); } };
  const pickDefault = async (id) => { if (await put({ provider: id })) after(); };
  const resetPrefs = () => { setMode(st.mode); setIns(st.instructions || ''); };
  const admin = !!(st && st.admin);
  const live = st ? st.providers.filter((p) => p.connected) : [];
  const prefsDirty = !!st && (mode !== st.mode || ins.trim() !== (st.instructions || '').trim());
  const cardDirty = Object.values(cards).some(Boolean);
  const onCardDirty = (id, on) => setCards((c) => (!!c[id] === on ? c : Object.assign({}, c, { [id]: on })));
  const requestClose = () => { if (prefsDirty || cardDirty) setLeaving(true); else d.close(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
    if (e.key !== 'Tab') return;
    const items = Array.from(dialog.current.querySelectorAll('button:not([tabindex="-1"]), a[href], input, textarea')).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const a = document.activeElement;
    if (e.shiftKey && (a === items[0] || a === dialog.current)) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && a === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
  };
  const panes = [{ id: 'chat', label: 'Your chat' }].concat(admin ? [{ id: 'workspace', label: 'Workspace' }] : []).concat([{ id: 'models', label: admin ? 'Models & keys' : 'Models', count: live.length }]);
  // With nothing connected yet, connecting a provider is the first job.
  const cur = pane || (admin && !live.length ? 'models' : 'chat');
  const paneStyle = (id) => css('flex: 1; min-width: 0; box-sizing: border-box; flex-direction: column; gap: 16px; padding: 20px 24px 24px; overflow-y: auto; display: ' + (cur === id ? 'flex' : 'none'));
  // On phones the section list scrolls sideways; keep the open section in view.
  useEffect(() => {
    const tab = dialog.current && dialog.current.querySelector('.fb-be-tab[aria-current]');
    if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [cur, !st]); // eslint-disable-line react-hooks/exhaustive-deps
  const providerOpts = live.map((p) => ({ value: p.id, label: p.name, note: p.model, icon: <ProviderDot id={p.id} /> }));
  return (
    <>
      <button type="button" tabIndex={-1} aria-label="Close AI settings" onClick={requestClose} style={css('position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default')}></button>
      <dialog ref={dialog} open tabIndex={-1} aria-modal="true" aria-labelledby="ais-title" onKeyDown={onKey} className="fb-be" style={css('position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; width: min(820px, calc(100vw - 32px)); height: 660px; max-height: calc(100vh - 48px); overflow: hidden; box-sizing: border-box; margin: 0; padding: 0; border: 1px solid var(--line-3); border-radius: 24px; outline: none; background: var(--surface-2, var(--surface)); color: var(--ink); box-shadow: 0 24px 80px rgba(0,0,0,0.24)')}>
        <header style={css('display: flex; align-items: center; gap: 12px; padding: 16px 16px 16px 20px; border-bottom: 1px solid var(--line)')}>
          <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}>
            <h2 id="ais-title" style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em')}>AI settings</h2>
            <p style={css('margin: 0; font-size: 13px; line-height: 1.4; color: var(--muted)')}>{admin ? 'How the Daily assistant answers for everyone in the workspace.' : 'The models connected to the Daily assistant.'}</p>
          </div>
          <button type="button" className="fb-ni" aria-label="Close" onClick={requestClose} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Ico d={P.x} size={18} /></button>
        </header>
        {!st ? (
          <div role="status" style={css('flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: var(--muted)')}>
            {err ? null : <><Spinner />Loading settings…</>}
          </div>
        ) : (
          <div className="fb-be-body" style={css('flex: 1; min-height: 0; display: flex')}>
            <nav aria-label="AI settings sections" className="fb-be-rail" style={css('flex: 0 0 204px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; padding: 12px; border-right: 1px solid var(--line); overflow-y: auto')}>
              {panes.map((p) => {
                const on = cur === p.id;
                return (
                  <button key={p.id} type="button" className="fb-mr fb-be-tab" aria-current={on ? 'true' : undefined} onClick={() => setPane(p.id)}
                    style={css('display: flex; align-items: center; gap: 10px; flex: none; min-height: 38px; padding: 0 10px; border: 0; border-radius: 10px; font-size: 14px; font-weight: ' + (on ? 600 : 500) + '; letter-spacing: normal; text-align: left; white-space: nowrap; cursor: pointer; background: ' + (on ? 'var(--hover)' : 'transparent') + '; color: ' + (on ? 'var(--ink)' : 'var(--ink-3)') + ';')}>
                    <Icon d={PANE_ICON[p.id]} />
                    <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis')}>{p.label}</span>
                    {p.count ? <span style={css('flex: none; font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--muted-2)')}>{p.count}</span> : null}
                  </button>
                );
              })}
            </nav>
            <section aria-labelledby="ais-chat" className="fb-pop fb-be-pane" style={paneStyle('chat')}>
              <PaneHead id="ais-chat" title="Your chat" help="Saved on this device. It does not change anything for other members." />
              <ModeCards label="Answer mode on this device" caption="Answer mode" value={d.mode} onChange={d.setMode} />
            </section>
            {admin ? (
              <section aria-labelledby="ais-ws" className="fb-pop fb-be-pane" style={paneStyle('workspace')}>
                <PaneHead id="ais-ws" title="Workspace assistant" help="Defaults for everyone in the workspace. Members can still switch model and mode in their own chat." />
                {live.length ? (
                  <Dropdown label="Default provider" value={st.provider} options={providerOpts} onChange={pickDefault} disabled={busy} minMenuWidth={320} />
                ) : (
                  <div style={css('display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 12px; border: 1px dashed var(--border); border-radius: 12px; font-size: 13px; color: var(--muted)')}>
                    No provider is connected yet.
                    <button type="button" className="fb-mr" onClick={() => setPane('models')} style={css(SMALL_BTN)}>Connect one</button>
                  </div>
                )}
                <ModeCards label="Default answer mode" caption="Default answer mode for new members" value={mode} onChange={setMode} disabled={!st.prefsReady} />
                <div style={css('display: flex; flex-direction: column; gap: 6px')}>
                  <Field label="Instructions for every chat" multiline rows={5} maxLength={MAX_INSTRUCTIONS} disabled={!st.prefsReady} placeholder="e.g. Answer in a friendly tone. Always mention the editor when talking about a project." value={ins} onChange={(e) => setIns(e.target.value)} />
                  <div style={css('display: flex; justify-content: space-between; gap: 12px')}>
                    <p style={css(HINT)}>{st.prefsReady ? 'Added to the assistant\'s instructions. Board rules and permissions still apply.' : 'Run the assistant settings database migration to save these.'}</p>
                    <span style={css(HINT + ' flex: none; font-variant-numeric: tabular-nums;')}>{ins.length.toLocaleString()} / {MAX_INSTRUCTIONS.toLocaleString()}</span>
                  </div>
                </div>
              </section>
            ) : null}
            <section aria-labelledby="ais-keys" className="fb-pop fb-be-pane" style={paneStyle('models')}>
              <PaneHead id="ais-keys" title={admin ? 'Models & API keys' : 'Connected models'} help={admin ? 'Keys are checked with a live call, then stored encrypted. Nobody can read them back, including you.' : null} />
              {st.providers.map((pr) => (
                <ProviderCard key={pr.id + pr.model + (pr.connected ? '1' : '0')} pr={pr} admin={admin} isDefault={pr.id === st.provider} A={d.A} after={after} onDirty={onCardDirty} />
              ))}
            </section>
          </div>
        )}
        {err ? <p role="alert" style={css('margin: 0; padding: 10px 20px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600')}>{err}</p> : null}
        {leaving ? (
          <footer style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px 12px 20px; border-top: 1px solid var(--line)')}>
            <p role="alert" style={css('flex: 1 1 200px; margin: 0; font-size: 13px; font-weight: 600; color: var(--ink)')}>Discard your unsaved changes?</p>
            <button type="button" className="fb-mr" onClick={() => setLeaving(false)} style={css(SMALL_BTN + ' height: 40px; padding: 0 14px;')}>Keep editing</button>
            <button type="button" onClick={d.close} style={css(btnStyle('danger') + ' letter-spacing: normal;')}>Discard</button>
          </footer>
        ) : prefsDirty || saved ? (
          <footer style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px 12px 20px; border-top: 1px solid var(--line)')}>
            <span role="status" style={css('flex: 1; font-size: 13px; color: var(--muted-2)')}>{prefsDirty ? 'Unsaved workspace defaults' : 'Saved.'}</span>
            {prefsDirty ? (
              <>
                <button type="button" className="fb-mr" disabled={busy} onClick={resetPrefs} style={css(SMALL_BTN + ' height: 40px; padding: 0 14px;')}>Discard</button>
                <button type="button" disabled={busy || !st.prefsReady} onClick={savePrefs} style={css(btnStyle('primary') + ' letter-spacing: normal;' + (st.prefsReady ? '' : OFF_BTN))}>{busy ? <Spinner /> : null}{busy ? 'Saving…' : 'Save changes'}</button>
              </>
            ) : null}
          </footer>
        ) : null}
      </dialog>
    </>
  );
}
