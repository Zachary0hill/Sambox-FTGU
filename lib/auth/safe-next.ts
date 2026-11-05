// Only relative paths within this dashboard may follow an authentication exchange.
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/';
  try {
    const base = 'https://dashboard.invalid';
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}
