'use client';
// app: Daily assistant chat parts, hand written (not from the design canvas): reply text with light markdown, the
// collapsible Thinking block, tool steps, reply actions, the composer's model picker and Fast / Think toggle, and the
// AI settings dialog behind the gear in the Daily header. Styles use the board's tokens through css().
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';

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
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
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
// Integrations actions (the server checks each key with a live call before storing it in Vault).
const LBL = 'font-size: 13px; font-weight: 600; color: var(--ink-3);';
const INPUT = 'width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); font-size: 14px; color: var(--ink);';
const BTN = 'min-height: 40px; padding: 0 16px; border: 0; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;';
const PRIMARY = BTN + ' background: var(--inv); color: var(--inv-ink);';
const QUIET = BTN + ' background: var(--chip-2); color: var(--ink-2);';

function Seg({ value, options, onChange, label, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} style={css('display: inline-flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--chip)')}>
      {options.map((o) => {
        const on = value === o[0];
        return <button key={o[0]} type="button" role="radio" aria-checked={on ? 'true' : 'false'} disabled={disabled} onClick={() => onChange(o[0])} style={css('display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 0; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: ' + (disabled ? 'default' : 'pointer') + '; ' + (on ? 'background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--muted);'))}>{o[2] ? <Ico d={o[2]} size={14} /> : null}{o[1]}</button>;
      })}
    </div>
  );
}

function ProviderCard({ pr, admin, isDefault, A, after }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
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
  const save = async () => {
    setBusy('save'); setErr('');
    const ok = await A.saveIntegration({ provider: pr.id, name: pr.name }, Object.assign({ model }, key.trim() ? { apiKey: key.trim() } : {}));
    setBusy('');
    if (ok) { setKey(''); after(); } else setErr('Not saved. Check the key and model.');
  };
  const drop = async () => { setBusy('drop'); await A.disconnectIntegration({ provider: pr.id, name: pr.name }); setBusy(''); after(); };
  const pill = pr.connected
    ? ['Connected' + (pr.keyHint ? ' · ••••' + pr.keyHint : ''), 'background: var(--green-soft, rgba(16,163,127,0.12)); color: var(--green-ink, #0B7A5F);']
    : ['Not connected', 'background: var(--chip-2); color: var(--muted);'];
  const opts = models ? [pr.model].concat(models.filter((x) => x !== pr.model)) : [pr.model];
  return (
    <section aria-label={pr.name} style={css('display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--line-3); border-radius: 16px; background: var(--surface)')}>
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap')}>
        <span aria-hidden="true" style={css('width: 10px; height: 10px; border-radius: 999px; background: ' + (DOT[pr.id] || 'var(--muted)'))}></span>
        <span style={css('font-size: 15px; font-weight: 700; color: var(--ink)')}>{pr.name}</span>
        <span style={css('display: inline-flex; align-items: center; min-height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 600; ' + pill[1])}>{pill[0]}</span>
        {isDefault ? <span style={css('display: inline-flex; align-items: center; min-height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--inv); color: var(--inv-ink)')}>Default</span> : null}
        <span style={css('flex: 1')}></span>
        {admin && pr.keyUrl ? <a href={pr.keyUrl} target="_blank" rel="noopener noreferrer" style={css('font-size: 13px; font-weight: 600; color: var(--ink-3)')}>Get a key</a> : null}
      </div>
      {pr.error ? <p role="alert" style={css('margin: 0; font-size: 13px; color: var(--red-ink)')}>{pr.error}</p> : null}
      {admin ? (
        <>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px')}>
            <label style={css('display: flex; flex-direction: column; gap: 6px')}>
              <span style={css(LBL)}>API key</span>
              <span style={css('position: relative; display: flex')}>
                <input type={show ? 'text' : 'password'} autoComplete="off" spellCheck="false" placeholder={pr.connected ? 'Leave blank to keep the saved key' : 'Paste the API key'} value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => { if (key.trim() && !pr.connected) load(key.trim()); }} style={css(INPUT + ' padding-right: 44px;')} />
                <button type="button" aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)} style={css('position: absolute; right: 4px; top: 4px; width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Ico d={P.eye} size={16} /></button>
              </span>
            </label>
            <label style={css('display: flex; flex-direction: column; gap: 6px')}>
              <span style={css(LBL)}>Default model{busy === 'models' ? ' · loading' : ''}</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={css(INPUT + ' appearance: auto;')}>
                {opts.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          </div>
          {err ? <p role="alert" style={css('margin: 0; font-size: 13px; font-weight: 600; color: var(--red-ink)')}>{err}</p> : null}
          <div style={css('display: flex; align-items: center; gap: 8px; flex-wrap: wrap')}>
            <button type="button" onClick={save} disabled={!!busy || (!dirty && pr.connected) || (!pr.connected && !key.trim())} style={css(PRIMARY + ((busy || (!dirty && pr.connected) || (!pr.connected && !key.trim())) ? ' opacity: 0.5; cursor: default;' : ''))}>{busy === 'save' ? 'Checking key…' : pr.connected ? 'Save' : 'Connect'}</button>
            {pr.connected && !models ? <button type="button" onClick={() => load('')} disabled={!!busy} style={css(QUIET)}>Load models</button> : null}
            <span style={css('flex: 1')}></span>
            {pr.connected ? <button type="button" onClick={drop} disabled={!!busy} style={css(BTN + ' background: transparent; color: var(--red-ink);')}>{busy === 'drop' ? 'Disconnecting…' : 'Disconnect'}</button> : null}
          </div>
        </>
      ) : (
        <p style={css('margin: 0; font-size: 14px; color: var(--muted)')}>{pr.connected ? 'Default model: ' + pr.model : 'A Super Admin can connect this provider.'}</p>
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
  const load = () => fetch('/api/assistant/settings', { cache: 'no-store' }).then((r) => r.json().then((j) => {
    if (!r.ok) throw new Error(j.error || 'Could not load AI settings.');
    setSt(j); setMode(j.mode); setIns(j.instructions || ''); setErr('');
  })).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') d.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);
  const after = () => { load(); d.onChanged(); };
  const put = async (body) => {
    setBusy(true); setErr('');
    const r = await fetch('/api/assistant/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setErr(j.error || 'Could not save AI settings.'); return false; }
    return true;
  };
  const savePrefs = async () => { if (await put({ mode, instructions: ins })) { setSaved(true); setTimeout(() => setSaved(false), 1800); after(); } };
  const pickDefault = async (id) => { if (await put({ provider: id })) after(); };
  const admin = !!(st && st.admin);
  const live = st ? st.providers.filter((p) => p.connected) : [];
  const prefsDirty = st && (mode !== st.mode || ins.trim() !== (st.instructions || '').trim());
  return (
    <>
      <button type="button" aria-label="Close AI settings" onClick={d.close} style={css('position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default')}></button>
      <dialog open aria-modal="true" aria-labelledby="ais-title" style={css('position: fixed; z-index: 41; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; margin: 0; padding: 24px; border: 1px solid var(--line-3); border-radius: 24px; background: var(--surface-2, var(--surface)); color: var(--ink); box-shadow: 0 24px 80px rgba(0,0,0,0.24)')}>
        <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px')}>
          <div>
            <h2 id="ais-title" style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em')}>AI settings</h2>
            <p style={css('margin: 6px 0 0; font-size: var(--text-body-sm); color: var(--muted)')}>{admin ? 'Models, API keys and how the Daily assistant answers for everyone in the workspace.' : 'The models connected to the Daily assistant. Your model and Fast / Think choice are saved on this device.'}</p>
          </div>
          <button type="button" className="fb-ni" aria-label="Close" onClick={d.close} style={css('width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer')}><Ico d={P.x} size={18} /></button>
        </div>
        {err ? <p role="alert" style={css('margin: 0 0 16px; padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600')}>{err}</p> : null}
        {!st ? (!err ? <p style={css('margin: 0; color: var(--muted)')}>Loading…</p> : null) : (
          <div style={css('display: flex; flex-direction: column; gap: 28px')}>
            <section aria-labelledby="ais-chat" style={css('display: flex; flex-direction: column; gap: 14px')}>
              <h3 id="ais-chat" style={css('margin: 0; font-size: 15px; font-weight: 700')}>Your chat</h3>
              <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap')}>
                <div style={css('display: flex; flex-direction: column; gap: 2px')}>
                  <span style={css(LBL)}>Answer mode on this device</span>
                  <span style={css('font-size: 13px; color: var(--muted-2)')}>Fast starts writing right away. Think reasons first and shows its thinking.</span>
                </div>
                <Seg label="Answer mode on this device" value={d.mode} onChange={d.setMode} options={[['fast', 'Fast', P.bolt], ['think', 'Think', P.brain]]} />
              </div>
            </section>
            {admin ? (
              <section aria-labelledby="ais-ws" style={css('display: flex; flex-direction: column; gap: 14px')}>
                <h3 id="ais-ws" style={css('margin: 0; font-size: 15px; font-weight: 700')}>Workspace assistant</h3>
                <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap')}>
                  <span style={css(LBL)}>Default model provider</span>
                  {live.length ? <Seg label="Default model provider" value={st.provider} onChange={pickDefault} disabled={busy} options={live.map((p) => [p.id, p.name])} /> : <span style={css('font-size: 13px; color: var(--muted)')}>Connect a provider below first.</span>}
                </div>
                <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap')}>
                  <span style={css(LBL)}>Default answer mode for new members</span>
                  <Seg label="Default answer mode" value={mode} onChange={setMode} disabled={!st.prefsReady} options={[['fast', 'Fast', P.bolt], ['think', 'Think', P.brain]]} />
                </div>
                <label style={css('display: flex; flex-direction: column; gap: 6px')}>
                  <span style={css(LBL)}>Instructions for every chat</span>
                  <textarea rows={4} maxLength={4000} disabled={!st.prefsReady} placeholder="e.g. Answer in a friendly tone. Always mention the editor when talking about a project." value={ins} onChange={(e) => setIns(e.target.value)} style={css(INPUT + ' min-height: 100px; padding: 10px 12px; resize: vertical; line-height: 1.5; font-family: inherit;')} />
                  <span style={css('font-size: 12px; color: var(--muted-2)')}>{st.prefsReady ? 'Added to the assistant\'s instructions. Board rules and permissions still apply.' : 'Run the assistant settings database migration to save these.'}</span>
                </label>
                <div style={css('display: flex; align-items: center; gap: 10px')}>
                  <button type="button" onClick={savePrefs} disabled={busy || !prefsDirty || !st.prefsReady} style={css(PRIMARY + (busy || !prefsDirty || !st.prefsReady ? ' opacity: 0.5; cursor: default;' : ''))}>{busy ? 'Saving…' : 'Save'}</button>
                  {saved ? <span role="status" style={css('font-size: 13px; font-weight: 600; color: var(--muted)')}>Saved.</span> : null}
                </div>
              </section>
            ) : null}
            <section aria-labelledby="ais-keys" style={css('display: flex; flex-direction: column; gap: 12px')}>
              <h3 id="ais-keys" style={css('margin: 0; font-size: 15px; font-weight: 700')}>{admin ? 'Models & API keys' : 'Connected models'}</h3>
              {admin ? <p style={css('margin: -4px 0 0; font-size: 13px; color: var(--muted-2)')}>Keys are checked with a live call, then stored encrypted. Nobody can read them back, including you.</p> : null}
              {st.providers.map((pr) => (
                <Fragment key={pr.id}>
                  <ProviderCard key={pr.model + (pr.connected ? '1' : '0')} pr={pr} admin={admin} isDefault={pr.id === st.provider} A={d.A} after={after} />
                </Fragment>
              ))}
            </section>
          </div>
        )}
      </dialog>
    </>
  );
}
