import { useEffect, useRef } from 'react';

// Controls that keep their own click or drag: a press that starts on one never starts the box.
const SKIP = 'input, textarea, select, label, [contenteditable="true"], [role="listbox"], [role="menu"], [draggable="true"]';
const EDGE = 56;   // px from the top or bottom of the window where the page starts to scroll
const SLOP = 6;    // px the pointer has to travel before a press becomes a drag

// Drag a box over the ideas to check every one it touches (mouse only: a touch drag scrolls the page).
// Anything with data-idea-id inside counts. Holding Shift, Cmd or Ctrl adds to what is already checked; a plain drag
// starts over. The page scrolls when the pointer nears the top or bottom, and Esc puts the selection back.
export default function IdeaMarquee({ on, selected, onSelect, children }) {
  const wrap = useRef(null), box = useRef(null);
  const live = useRef({ selected, onSelect });
  useEffect(() => { live.current = { selected, onSelect }; });

  useEffect(() => {
    const el = wrap.current;
    if (!el || !on) return undefined;
    let d = null, raf = 0;
    const page = () => document.scrollingElement || document.documentElement;

    const paint = () => {
      raf = 0;
      if (!d || !d.live) return;
      // Scroll first, so the box and the hit test see where the rows ended up.
      const step = d.y < EDGE ? -Math.ceil((EDGE - d.y) / 4) : d.y > window.innerHeight - EDGE ? Math.ceil((d.y - (window.innerHeight - EDGE)) / 4) : 0;
      if (step) page().scrollTop += Math.max(-16, Math.min(16, step));
      // The start point is kept in page space, so the box keeps growing as the page scrolls under it.
      const y0 = d.y0 - page().scrollTop;
      const r = { left: Math.min(d.x0, d.x), right: Math.max(d.x0, d.x), top: Math.min(y0, d.y), bottom: Math.max(y0, d.y) };
      const b = box.current;
      if (b) { b.style.display = 'block'; b.style.left = r.left + 'px'; b.style.top = r.top + 'px'; b.style.width = (r.right - r.left) + 'px'; b.style.height = (r.bottom - r.top) + 'px'; }
      const hits = [];
      el.querySelectorAll('[data-idea-id]').forEach((n) => {
        const q = n.getBoundingClientRect();
        if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push(n.getAttribute('data-idea-id'));
      });
      const next = d.base.concat(hits.filter((id) => d.base.indexOf(id) < 0));
      const key = next.join('|');
      if (key !== d.key) { d.key = key; live.current.onSelect(next); }
      if (step) raf = requestAnimationFrame(paint);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('scroll', queue, true);
      window.removeEventListener('keydown', key, true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (box.current) box.current.style.display = 'none';
      document.documentElement.classList.remove('fb-marquee-on');
      d = null;
    };
    const move = (e) => {
      if (!d) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.live) {
        if (Math.abs(d.x - d.x0) < SLOP && Math.abs(d.y + page().scrollTop - d.y0) < SLOP) return;
        d.live = true;
        document.documentElement.classList.add('fb-marquee-on');
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      }
      e.preventDefault();
      queue();
    };
    const up = () => {
      if (!d) return;
      if (d.live) {
        // The press ended a drag, so the click that follows must not open the idea under the pointer.
        const eat = (e) => { e.stopPropagation(); e.preventDefault(); };
        window.addEventListener('click', eat, true);
        setTimeout(() => window.removeEventListener('click', eat, true), 0);
      }
      stop();
    };
    const key = (e) => {
      if (!d || !d.live || e.key !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation();
      live.current.onSelect(d.was);
      stop();
    };
    const down = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || d) return;
      if (e.target.closest && e.target.closest(SKIP)) return;
      const was = (live.current.selected || []).slice(), add = e.shiftKey || e.metaKey || e.ctrlKey;
      d = { x0: e.clientX, y0: e.clientY + page().scrollTop, x: e.clientX, y: e.clientY, live: false, was: was, base: add ? was : [], key: null };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      window.addEventListener('scroll', queue, true);
      window.addEventListener('keydown', key, true);
    };
    el.addEventListener('pointerdown', down);
    return () => { el.removeEventListener('pointerdown', down); stop(); };
  }, [on]);

  return (
    <div ref={wrap} className="fb-marquee-zone">
      {children}
      <div ref={box} className="fb-marquee" aria-hidden="true"></div>
    </div>
  );
}
