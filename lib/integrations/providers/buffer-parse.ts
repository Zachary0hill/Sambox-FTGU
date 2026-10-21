// Pure helpers for the Buffer sync: no network, no server-only imports, so they can be tested on their own.

type Json = Record<string, unknown>;

export type BufferMetric = { type: string; name: string; value: number; unit: string };

// Normalized PostMetricType values kept as columns. Everything Buffer returns also goes into the metrics jsonb.
const COLUMNS: Record<string, string> = {
  impressions: 'impressions', reach: 'reach', views: 'views', reactions: 'reactions', comments: 'comments',
  shares: 'shares', reposts: 'reposts', saves: 'saves', clicks: 'clicks',
};

export function metricsOf(list: unknown): BufferMetric[] {
  if (!Array.isArray(list)) return [];
  return list.filter((m) => m && typeof m === 'object' && Number.isFinite(Number((m as Json).value))).map((m) => {
    const x = m as Json;
    return { type: String(x.type || ''), name: String(x.name || x.type || ''), value: Number(x.value), unit: String(x.unit || 'count') };
  }).filter((m) => m.type);
}

// Column values for one post. A metric the network did not report stays null: missing does not mean zero.
export function metricColumns(list: BufferMetric[]): Record<string, number | null> {
  const out: Record<string, number | null> = { engagement_rate: null };
  Object.values(COLUMNS).forEach((c) => { out[c] = null; });
  list.forEach((m) => {
    if (COLUMNS[m.type]) out[COLUMNS[m.type]] = Math.round(m.value);
    else if (m.type === 'engagementRate') out.engagement_rate = Math.round(m.value * 100) / 100;
  });
  return out;
}

const https = (u: unknown) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);

export function channelRow(ws: string, org: { id: string; name: string }, c: Json, now: string) {
  return {
    workspace_id: ws, channel_id: String(c.id), organization_id: org.id, organization_name: org.name,
    service: String(c.service || ''), channel_type: String(c.type || ''), name: String(c.name || ''),
    display_name: c.displayName ? String(c.displayName) : null, avatar_url: https(c.avatar), external_link: https(c.externalLink),
    is_disconnected: !!c.isDisconnected, is_locked: !!c.isLocked, synced_at: now,
  };
}

export function postRow(ws: string, orgId: string, p: Json, now: string) {
  const assets = Array.isArray(p.assets) ? (p.assets as Json[]) : [];
  const thumb = assets.map((a) => https(a && a.thumbnail)).find(Boolean) || null;
  const metrics = metricsOf(p.metrics);
  return {
    workspace_id: ws, post_id: String(p.id), channel_id: String(p.channelId || ''), organization_id: orgId,
    service: String(p.channelService || ''), text: String(p.text || '').slice(0, 500), thumbnail_url: thumb,
    external_link: https(p.externalLink), sent_at: (p.sentAt as string) || null, due_at: (p.dueAt as string) || null,
    ...metricColumns(metrics), metrics, metrics_updated_at: (p.metricsUpdatedAt as string) || null, synced_at: now,
  };
}

// Lowest requests-remaining across the RateLimit policies (15 min, 24 h, 30 days), and the seconds until that
// window resets. The header repeats once per window; fetch joins the copies with ", ".
export function rateLeft(header: string | null): { left: number; reset: number } | null {
  if (!header) return null;
  let best: { left: number; reset: number } | null = null;
  header.split(/,\s*(?=")/).forEach((p) => {
    const r = /;\s*r=(\d+)/.exec(p), t = /;\s*t=(\d+)/.exec(p);
    if (!r) return;
    const cur = { left: Number(r[1]), reset: t ? Number(t[1]) : 0 };
    if (!best || cur.left < best.left) best = cur;
  });
  return best;
}

export const waitText = (s: number) => (s >= 5400 ? Math.round(s / 3600) + ' hours' : s >= 90 ? Math.round(s / 60) + ' minutes' : s + ' seconds');

export const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
