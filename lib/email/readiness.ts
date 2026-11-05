import 'server-only';
import { Resend } from 'resend';
import { emailHealth } from './send';

// This checks configuration only. It never sends mail or upgrades a delivery status.
export async function emailReadiness() {
  const health = emailHealth();
  let canonicalUrl: string | null = null;
  try {
    const url = new URL(process.env.APP_BASE_URL || '');
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) canonicalUrl = url.origin;
  } catch { /* missing or malformed configuration */ }
  const sender = process.env.EMAIL_FROM || '';
  const domain = sender.match(/@([^<>\s]+)>?\s*$/)?.[1]?.toLowerCase();
  let domainStatus: 'verified' | 'unverified' | 'unknown' = 'unknown';
  if (health.configured && !health.sandboxSender && domain) {
    try {
      // Sending-only credentials may not inspect domains. That is unknown, not a delivery failure.
      const result = await new Resend(process.env.RESEND_API_KEY).domains.list({ limit: 100 }, { signal: AbortSignal.timeout(4000) });
      if (!result.error && result.data) {
        const match = result.data.data.find((item) => item.name.toLowerCase() === domain);
        domainStatus = match ? (match.status === 'verified' && match.capabilities?.sending === 'enabled' ? 'verified' : 'unverified') : result.data.has_more ? 'unknown' : 'unverified';
      }
    } catch { /* diagnostic unavailable; never return provider internals */ }
  }
  return {
    ...health, canonicalUrl, domainStatus,
    authEmailStatus: 'separate-verification-required',
    schedulerCredentialsConfigured: !!process.env.CRON_SECRET,
    checkedAt: new Date().toISOString(),
  };
}
