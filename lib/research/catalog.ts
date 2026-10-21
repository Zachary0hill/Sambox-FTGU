// Research sources the agent can use, shared by the Ideas page and the server. Nothing secret here.
import type { ProviderId } from '@/lib/integrations/registry';

export type SourceId = 'youtube' | 'tiktok' | 'reddit' | 'google' | 'youtube_browser' | 'web';

export type SourceDef = { id: SourceId; label: string; via: ProviderId; viaName: string; desc: string };

export const SOURCES: SourceDef[] = [
  { id: 'youtube', label: 'YouTube', via: 'apify', viaName: 'Apify', desc: 'Top videos for each topic this month' },
  { id: 'tiktok', label: 'TikTok', via: 'apify', viaName: 'Apify', desc: 'Top TikTok videos for each topic' },
  { id: 'reddit', label: 'Reddit', via: 'apify', viaName: 'Apify', desc: 'Top posts this month' },
  { id: 'google', label: 'Google', via: 'apify', viaName: 'Apify', desc: 'First page of Google results' },
  { id: 'youtube_browser', label: 'YouTube search', via: 'browserbase', viaName: 'Browserbase', desc: 'Live YouTube search page in a cloud browser' },
  { id: 'web', label: 'Web articles', via: 'firecrawl', viaName: 'Firecrawl', desc: 'Web search with page summaries' },
];

export const RESEARCH_PROVIDERS: ProviderId[] = ['apify', 'browserbase', 'firecrawl'];

export const LIMITS = {
  maxTopics: 3,
  maxIdeas: 10,
  defaultIdeas: 5,
  perTopic: 8, // items each source keeps per topic
  maxFindings: 80, // findings sent to the model
  runSecs: 285, // whole run, under the route's maxDuration
  sourceSecs: 180, // gathering phase
};

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

// Seed topics from a brand kit when the Super Admin leaves the niche blank.
export function defaultTopics(brand: { name?: string; tone?: string[]; sections?: unknown } | null | undefined): string {
  if (!brand) return '';
  const secs = Array.isArray(brand.sections) ? brand.sections : [];
  const titles = secs.map((x) => (Array.isArray(x) ? String(x[0] || '') : x && typeof x === 'object' ? String((x as { title?: string }).title || '') : String(x || '')))
    .map((t) => t.trim()).filter(Boolean);
  return [brand.name || ''].concat(titles).filter(Boolean).slice(0, LIMITS.maxTopics).join(', ');
}

export function parseTopics(text: string): string[] {
  const seen = new Set<string>();
  return String(text || '').split(/[\n,;]+/).map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 80)).filter((t) => {
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, LIMITS.maxTopics);
}
