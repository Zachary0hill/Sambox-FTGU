// Next job number following the workspace's most common pattern, e.g. FTGU-041 -> FTGU-042.
// Returns '' when no existing code ends in digits, so the caller can fall back to a typed value.
export function nextJob(codes) {
  const groups = {};
  (codes || []).forEach((c) => {
    const m = /^(.*?)(\d+)$/.exec(String(c || '').trim());
    if (!m) return;
    const g = (groups[m[1]] = groups[m[1]] || { n: 0, width: 0, count: 0 });
    g.n = Math.max(g.n, Number(m[2]));
    g.width = Math.max(g.width, m[2].length);
    g.count++;
  });
  const best = Object.entries(groups).sort((a, b) => b[1].count - a[1].count)[0];
  if (!best) return '';
  return best[0] + String(best[1].n + 1).padStart(best[1].width, '0');
}
