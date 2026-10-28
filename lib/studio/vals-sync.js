// The picker shown before a manual integration sync: what the sync would bring over, as checklists, so a Super Admin
// keeps only what they want. State lives in s.syncPick; the server side is preview() in lib/integrations/providers.

// Wraps A.syncIntegration so every manual "Sync now" opens the picker first. Quiet syncs (Performance > Sync now
// runs several at once) and syncs that already carry a pick go straight through.
export function withSyncPicker(A, set) {
  const syncIntegration = async (g, opts = {}) => {
    if (opts.quiet || opts.pick) return A.syncIntegration(g, opts);
    set({ syncPick: { g, loading: true, error: '', groups: [], q: '' } });
    try {
      const groups = await A.previewSync(g);
      if (!groups.some((x) => x.items && x.items.length)) {
        set((cur) => (cur.syncPick && cur.syncPick.g === g ? { syncPick: null } : {}));
        return A.syncIntegration(g, opts);
      }
      set((cur) => (cur.syncPick && cur.syncPick.g === g ? { syncPick: { ...cur.syncPick, loading: false, groups } } : {}));
    } catch (err) {
      set((cur) => (cur.syncPick && cur.syncPick.g === g ? { syncPick: { ...cur.syncPick, loading: false, error: err.message || 'Could not read ' + g.name + '.' } } : {}));
    }
    return { ok: true };
  };
  return Object.assign({}, A, { syncIntegration });
}

export function syncPickVals({ s, set, A }) {
  const P = s.syncPick;
  if (!P) return null;
  const g = P.g;
  const q = (P.q || '').trim().toLowerCase();
  const setGroups = (fn) => set((cur) => (cur.syncPick ? { syncPick: { ...cur.syncPick, groups: fn(cur.syncPick.groups) } } : {}));
  const setItems = (gid, test, on) => setGroups((gs) => gs.map((x) => (x.id !== gid ? x : { ...x, items: x.items.map((it) => (test(it) ? { ...it, on } : it)) })));
  const matches = (it) => !q || (it.label + ' ' + (it.note || '')).toLowerCase().includes(q);
  const total = P.groups.reduce((a, x) => a + x.items.length, 0);
  const picked = P.groups.reduce((a, x) => a + x.items.filter((it) => it.on).length, 0);
  const close = () => set({ syncPick: null });
  return {
    title: 'Sync ' + g.name, loading: !!P.loading, error: P.error || '',
    showSearch: total > 12, q: P.q || '', setQ: (v) => set((cur) => (cur.syncPick ? { syncPick: { ...cur.syncPick, q: v } } : {})),
    groups: P.groups.map((x) => {
      const n = x.items.filter((it) => it.on).length;
      const shown = x.items.filter(matches);
      const shownOn = shown.filter((it) => it.on).length;
      return {
        id: x.id, label: x.label, hint: x.hint || '', countText: n + ' of ' + x.items.length,
        all: { on: shown.length > 0 && shownOn === shown.length, mixed: shownOn > 0 && shownOn < shown.length, disabled: !shown.length,
          aria: (q ? 'Select every match in ' : 'Select all ') + x.label, toggle: () => setItems(x.id, matches, shownOn < shown.length) },
        allText: q ? 'All matches' : 'Select all',
        empty: !shown.length, emptyText: q ? 'Nothing matches "' + P.q + '".' : 'Nothing here.',
        items: shown.map((it) => ({ id: it.id, label: it.label, note: it.note || '',
          pick: { on: !!it.on, aria: it.label, toggle: () => setItems(x.id, (y) => y.id === it.id, !it.on) } }))
      };
    }),
    close: close,
    canSync: !P.loading && !P.error && picked > 0,
    syncText: P.loading ? 'Loading…' : 'Sync ' + picked + ' of ' + total,
    sync: () => {
      const pick = {};
      P.groups.forEach((x) => { pick[x.id] = x.items.filter((it) => it.on).map((it) => it.id); });
      set({ syncPick: null, integBusy: g.provider + ':sync' });
      A.syncIntegration(g, { pick }).then(() => set({ integBusy: '' }));
    },
    // A is the wrapped set from withSyncPicker, so this reopens the picker.
    retry: () => A.syncIntegration(g)
  };
}
