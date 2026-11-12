/** Report visible page visits and real interaction, at most once a minute.
 * No idle heartbeat, page contents, keystrokes or browsing history are stored.
 */
export function startActivityTracking(report: () => PromiseLike<unknown>) {
  let lastAttempt = -Infinity;
  let pending = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => document.visibilityState === 'visible' && document.hasFocus();
  const flush = () => {
    timer = undefined;
    if (stopped || !pending || !visible()) return;
    const wait = 60_000 - (Date.now() - lastAttempt);
    if (wait > 0) { timer = setTimeout(flush, wait); return; }
    pending = false;
    lastAttempt = Date.now();
    // Activity reporting must never interrupt the app, including during sign-out.
    void Promise.resolve().then(() => { if (!stopped) return report(); }).catch(() => {});
  };
  const active = (event?: Event) => {
    if (event && !event.isTrusted) return;
    if (!visible()) return;
    pending = true;
    if (!timer) flush();
  };
  const visibility = () => {
    // Discard queued events when hidden; returning to the page counts as a visit.
    if (!visible()) {
      pending = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    } else active();
  };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
  for (const name of events) window.addEventListener(name, active, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', visibility);
  window.addEventListener('blur', visibility);
  active();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    for (const name of events) window.removeEventListener(name, active);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('focus', visibility);
    window.removeEventListener('blur', visibility);
  };
}
