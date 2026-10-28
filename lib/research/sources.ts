import 'server-only';
import type { Page } from 'playwright-core';
import { runActor, type ApifyLimits } from '@/lib/integrations/providers/apify';
import { withBrowser } from '@/lib/integrations/providers/browserbase';
import { firecrawlSearch } from '@/lib/integrations/providers/firecrawl';
import { vidiqClient, callVidiq } from '@/lib/integrations/providers/vidiq';
import { virloSearch, type VirloPlatform } from '@/lib/integrations/providers/virlo';
import type { Connection } from '@/lib/integrations/secrets';
import { LIMITS, type SourceId } from './catalog';
import { fromGoogle, fromReddit, fromTiktok, fromVidiq, fromVirlo, fromWeb, fromYoutube, fromYoutubePage, type Finding } from './normalize';

// Apify Store actors, inputs checked against each actor's published input schema (latest build, Oct 2026):
// https://apify.com/streamers/youtube-scraper/input-schema
// https://apify.com/clockworks/tiktok-scraper/input-schema
// https://apify.com/trudax/reddit-scraper-lite/input-schema
// https://apify.com/apify/google-search-scraper/input-schema
// All four are pay-per-event; maxItems and maxTotalChargeUsd cap what one run can cost. TikTok and Google require
// maxTotalChargeUsd of at least $0.50 (their minimalMaxTotalChargeUsd).

type Draft = Omit<Finding, 'id'>;
export type SourceCtx = {
  topics: string[];
  deadline: number;
  onActorRun: (runId: string) => void | Promise<void>;
  cancelled: () => Promise<boolean>;
};
export type Conns = { apify: Connection | null; browserbase: Connection | null; firecrawl: Connection | null; vidiq: Connection | null; virlo: Connection | null };

const per = LIMITS.perTopic;
const capFor = (topics: string[]): ApifyLimits => ({ timeoutSecs: 150, maxItems: per * topics.length, maxTotalChargeUsd: 0.5 });

async function apify(conn: Connection, actor: string, input: unknown, lim: ApifyLimits, ctx: SourceCtx) {
  const { items } = await runActor<Record<string, unknown>>(conn.secret.apiToken, actor, input, lim, {
    deadline: ctx.deadline, onStart: ctx.onActorRun, cancelled: ctx.cancelled,
  });
  return items;
}

// Results come back as one dataset, so topic is matched from fields the actor echoes back, else the first topic.
const topicFrom = (topics: string[], ...hay: unknown[]) => {
  const h = hay.map((x) => String(x || '').toLowerCase()).join(' ');
  return topics.find((t) => h.includes(t.toLowerCase())) || topics[0];
};

const RUNNERS: Record<SourceId, (c: Conns, ctx: SourceCtx) => Promise<Draft[]>> = {
  async youtube(c, ctx) {
    const items = await apify(c.apify!, 'streamers~youtube-scraper', {
      searchQueries: ctx.topics, maxResults: per, maxResultsShorts: 0, maxResultStreams: 0,
      sortingOrder: 'views', dateFilter: 'month', videoType: 'video',
    }, { ...capFor(ctx.topics), memoryMbytes: 1024 }, ctx);
    return items.flatMap((i) => fromYoutube([i], topicFrom(ctx.topics, i.input, i.searchQuery, i.title, i.text)));
  },
  async tiktok(c, ctx) {
    const items = await apify(c.apify!, 'clockworks~tiktok-scraper', {
      searchQueries: ctx.topics, resultsPerPage: per, searchSection: '/video', excludePinnedPosts: true,
      shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSlideshowImages: false,
      shouldDownloadAvatars: false, shouldDownloadMusicCovers: false, downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES',
    }, capFor(ctx.topics), ctx);
    return items.flatMap((i) => fromTiktok([i], topicFrom(ctx.topics, i.searchQuery, i.input, i.text)));
  },
  async reddit(c, ctx) {
    const items = await apify(c.apify!, 'trudax~reddit-scraper-lite', {
      searches: ctx.topics, searchPosts: true, searchComments: false, searchCommunities: false, searchUsers: false, searchMedia: false,
      sort: 'top', time: 'month', includeNSFW: false, includeMediaLinks: true, skipComments: true, maxComments: 0,
      maxItems: per * ctx.topics.length, maxPostCount: per,
    }, capFor(ctx.topics), ctx);
    return items.flatMap((i) => fromReddit([i], topicFrom(ctx.topics, i.searchTerm, i.title, i.body)));
  },
  async google(c, ctx) {
    const items = await apify(c.apify!, 'apify~google-search-scraper', {
      queries: ctx.topics.join('\n'), maxPagesPerQuery: 1, quickDateRange: 'm6',
    }, { ...capFor(ctx.topics), maxItems: ctx.topics.length, memoryMbytes: 1024 }, ctx);
    return fromGoogle(items, (term) => topicFrom(ctx.topics, term)).slice(0, per * ctx.topics.length);
  },
  async youtube_browser(c, ctx) {
    const secs = Math.max(60, Math.floor((ctx.deadline - Date.now()) / 1000));
    return withBrowser(c.browserbase!.secret, c.browserbase!.config, secs, async (page) => {
      const out: Draft[] = [];
      for (const topic of ctx.topics) {
        if (Date.now() > ctx.deadline - 15000 || (await ctx.cancelled())) break;
        out.push(...fromYoutubePage(await youtubeSearch(page, topic), topic));
      }
      return out;
    });
  },
  async web(c, ctx) {
    const out: Draft[] = [];
    for (const topic of ctx.topics) {
      if (Date.now() > ctx.deadline - 10000 || (await ctx.cancelled())) break;
      const hits = await firecrawlSearch(c.firecrawl!.secret.apiKey, topic, { limit: 5, scrape: false });
      out.push(...fromWeb(hits, topic));
    }
    return out;
  },
  // vidIQ's outliers tool, one call (5 credits) per topic. The query argument is read from the tool's own schema.
  async vidiq(c, ctx) {
    const client = await vidiqClient(c.vidiq!.secret.apiKey);
    try {
      const def = (await client.listTools({ options: { timeout: 15000 } })).tools.find((t) => t.name === 'outliers');
      if (!def) throw new Error('vidIQ no longer offers the outliers tool.');
      const props = (def.inputSchema?.properties || {}) as Record<string, { type?: string }>;
      const required = (def.inputSchema as { required?: string[] } | undefined)?.required || [];
      const key = Object.keys(props).find((k) => /^(query|keywords?|topic|search|q|term)$/i.test(k))
        || required.find((k) => props[k]?.type === 'string') || Object.keys(props).find((k) => props[k]?.type === 'string');
      if (!key) throw new Error('Could not tell which vidIQ outliers field takes the search topic.');
      const out: Draft[] = [];
      for (const topic of ctx.topics) {
        if (Date.now() > ctx.deadline - 15000 || (await ctx.cancelled())) break;
        const text = await callVidiq(client, 'outliers', { [key]: topic }, Math.min(60000, ctx.deadline - Date.now()));
        out.push(...fromVidiq(text, topic).slice(0, per));
      }
      return out;
    } finally {
      await client.close().catch(() => {});
    }
  },
  // Virlo live search on TikTok, YouTube Shorts and Instagram Reels, one $0.01 call each per topic. The most-viewed
  // videos across the three platforms are kept. One platform failing only drops that platform.
  async virlo(c, ctx) {
    const platforms: VirloPlatform[] = ['tiktok', 'youtube', 'instagram'];
    const out: Draft[] = [];
    for (const topic of ctx.topics) {
      if (Date.now() > ctx.deadline - 15000 || (await ctx.cancelled())) break;
      const timeout = Math.min(30000, ctx.deadline - Date.now());
      const got = await Promise.allSettled(platforms.map((p) => virloSearch(c.virlo!.secret.apiKey, p, topic, timeout)));
      const ok = got.flatMap((g) => (g.status === 'fulfilled' ? [g.value] : []));
      if (!ok.length) throw (got[0] as PromiseRejectedResult).reason;
      out.push(...fromVirlo(ok.flat(), topic).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, per));
    }
    return out;
  },
};

export function runSource(id: SourceId, conns: Conns, ctx: SourceCtx) {
  return RUNNERS[id](conns, ctx);
}

// Reads the video list from a YouTube results page. The page is rendered by script, so a plain fetch cannot read it;
// the browser loads it and the list is read from the page's initial data, falling back to the rendered links.
async function youtubeSearch(page: Page, topic: string) {
  await page.goto('https://www.youtube.com/results?search_query=' + encodeURIComponent(topic), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('ytd-video-renderer, ytd-rich-item-renderer, form[action*="consent"]', { timeout: 15000 }).catch(() => null);
  const rows = await page.evaluate((limit: number) => {
    type R = { title: string; url: string; channel: string; views: string; published: string };
    const out: R[] = [];
    const text = (x: unknown): string => {
      const o = x as { simpleText?: string; runs?: { text: string }[] } | undefined;
      return o ? o.simpleText || (o.runs || []).map((r) => r.text).join('') : '';
    };
    const walk = (node: unknown, depth: number) => {
      if (!node || typeof node !== 'object' || depth > 40 || out.length >= limit) return;
      const n = node as Record<string, unknown>;
      const v = n.videoRenderer as Record<string, unknown> | undefined;
      if (v && typeof v.videoId === 'string') {
        out.push({
          title: text(v.title), url: 'https://www.youtube.com/watch?v=' + v.videoId, channel: text(v.ownerText),
          views: text(v.viewCountText), published: text(v.publishedTimeText),
        });
        return;
      }
      for (const k in n) walk(n[k], depth + 1);
    };
    walk((window as unknown as { ytInitialData?: unknown }).ytInitialData, 0);
    if (!out.length) {
      document.querySelectorAll('a#video-title').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (out.length < limit && href.includes('/watch')) out.push({ title: (a.getAttribute('title') || a.textContent || '').trim(), url: href, channel: '', views: '', published: '' });
      });
    }
    return out;
  }, per);
  return rows as unknown as Record<string, unknown>[];
}
