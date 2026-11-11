'use client';
import { useEffect, useRef } from 'react';
const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
// Dialog pickers use a fixed portal outside the transformed panel. Include those portals in the modal boundary.
export function useDialogFocus(ref) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const before = document.activeElement;
    const isTop = () => !document.querySelector('dialog:modal') && [...document.querySelectorAll('[data-focus-dialog]')].at(-1) === dialog;
    const roots = () => [dialog, ...document.querySelectorAll('[data-modal-portal]')];
    const items = () => roots().flatMap(root => [...root.querySelectorAll(focusable)]).filter(el => el.getClientRects().length && !el.closest('[inert]'));
    const contains = el => roots().some(root => root.contains(el));
    const focus = e => { if (isTop() && !contains(e.target)) (items()[0] || dialog).focus(); };
    const key = e => {
      if (!isTop() || e.key !== 'Tab') return;
      const all=items(), at=all.indexOf(document.activeElement);
      if (!all.length) { e.preventDefault(); dialog.focus(); return; }
      if (e.shiftKey && at<=0) { e.preventDefault(); all.at(-1).focus(); }
      else if (!e.shiftKey && (at<0 || at===all.length-1)) { e.preventDefault(); all[0].focus(); }
    };
    // Inert the app background, preserving the backdrop and future picker portals.
    const muted=[];
    const mute = () => {
      for (let branch=dialog; branch?.parentElement; branch=branch.parentElement) {
        for (const el of branch.parentElement.children) {
          if (el===branch || el.matches('dialog,[data-modal-portal],button[aria-label^="Close"]') || el.querySelector('dialog:modal,[data-modal-portal]') || el.hasAttribute('inert')) continue;
          el.setAttribute('inert',''); muted.push(el);
        }
        if (branch.parentElement===document.body) break;
      }
    };
    mute();
    const observer=new MutationObserver(mute); observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('focusin',focus); document.addEventListener('keydown',key,true);
    (items()[0] || dialog).focus({preventScroll:true});
    return () => { observer.disconnect(); document.removeEventListener('focusin',focus); document.removeEventListener('keydown',key,true); muted.forEach(el=>el.removeAttribute('inert')); if (before?.isConnected) before.focus({preventScroll:true}); };
  }, [ref]);
}
export default function FocusDialog(props) { const ref=useRef(null); useDialogFocus(ref); return <dialog {...props} ref={ref} data-focus-dialog="" tabIndex={-1} />; }
