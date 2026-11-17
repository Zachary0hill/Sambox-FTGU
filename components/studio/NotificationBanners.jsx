'use client';
// Live pop-up banners: one card per notification that arrives while the board is open (Studio.jsx queues the ids,
// vals-pages.js builds the items). Top right on desktop, full width at the top on a phone. Each banner leaves after
// 6 seconds unless the pointer or keyboard focus is on it, or the tab is in the background.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Icon, IC } from './Prims';

const SHOW_MS = 6000;
const MAX = 3;

function Banner({ b }) {
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.visibilityState !== 'visible');
  // The item object is rebuilt on every render; the timer calls the newest dismiss without restarting.
  const dismiss = useRef(b.dismiss);
  useEffect(() => { dismiss.current = b.dismiss; }, [b.dismiss]);
  useEffect(() => {
    const vis = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  useEffect(() => {
    if (held || hidden) return;
    const t = setTimeout(() => dismiss.current(), SHOW_MS);
    return () => clearTimeout(t);
  }, [held, hidden]);

  return (
    <li className="fb-banner" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); b.dismiss(); } }}
      style={css('pointer-events: auto; display: flex; align-items: flex-start; gap: 4px; padding: 4px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--ink); box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.18);')}>
      <button type="button" onClick={b.open} aria-label={[b.typeLabel + ':', b.who, b.text, b.target].filter(Boolean).join(' ') + '. Open'}
        style={css('flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 12px; padding: 10px 4px 10px 10px; border: 0; border-radius: 12px; background: transparent; color: inherit; text-align: left; cursor: pointer; letter-spacing: normal; line-height: 1.4; font-family: inherit;')}>
        <span aria-hidden="true" style={css(b.avatarStyle)}>{b.initials}</span>
        <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;')}>
          <span style={css('display: flex; align-items: center; gap: 8px;')}>
            <span style={css(b.typeStyle)}>{b.typeLabel}</span>
            <span style={css('font-size: 12px; color: var(--muted-2);')}>Just now</span>
          </span>
          <span style={css('font-size: 14px; color: var(--ink-2); overflow-wrap: anywhere;')}>
            <b style={css('font-weight: 700; color: var(--ink);')}>{b.who}</b> {b.text} <b style={css('font-weight: 600; color: var(--ink);')}>{b.target}</b>
          </span>
          {b.quote ? <span style={css('font-size: 13px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere;')}>{b.quote}</span> : null}
        </span>
      </button>
      <button type="button" onClick={b.dismiss} aria-label="Dismiss notification" className="fb-banner-x"
        style={css('flex: none; width: 36px; height: 36px; border: 0; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--muted); cursor: pointer;')}>
        <Icon d={IC.x} />
      </button>
    </li>
  );
}

export default function NotificationBanners({ items, onMore }) {
  if (!items || !items.length) return null;
  const more = items.length - MAX;
  return (
    <section aria-label="New notifications" aria-live="polite" className="fb-banners"
      style={css('position: fixed; z-index: 95; top: max(16px, env(safe-area-inset-top)); right: 16px; width: 380px; max-width: calc(100vw - 32px); pointer-events: none; display: flex; flex-direction: column; gap: 8px;')}>
      <ul style={css('margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;')}>
        {items.slice(0, MAX).map((b) => <Banner key={b.id} b={b} />)}
      </ul>
      {more > 0 ? (
        <button type="button" onClick={onMore}
          style={css('pointer-events: auto; align-self: flex-end; min-height: 36px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--inv); color: var(--inv-ink); font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.18);')}>
          {more} more in Inbox
        </button>
      ) : null}
    </section>
  );
}
