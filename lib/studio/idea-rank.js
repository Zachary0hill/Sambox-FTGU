// Ideas board manual order: a card just placed keeps its place until the server agrees.
//
// Every write is followed by a full reload, and cards are often placed one after another. A reload that started before
// the latest drop was saved carries the old rank, which would put that card back for a second or two. The rank the
// person chose is held here and shown in place of the loaded one until a load returns the same number.
const held = new Map(); // idea id -> { rank, until }
const HOLD_MS = 15000;  // a write that never shows up (someone else moved the card since) stops being held

export function holdRank(id, rank) { held.set(id, { rank: rank, until: Date.now() + HOLD_MS }); }
export function releaseRank(id, rank) { const h = held.get(id); if (h && h.rank === rank) held.delete(id); }
// The rank to show for a row as loaded.
export function shownRank(id, loaded) {
  const h = held.get(id);
  if (!h) return loaded;
  if (h.rank === loaded || Date.now() > h.until) { held.delete(id); return loaded; }
  return h.rank;
}
