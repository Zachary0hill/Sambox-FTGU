import 'server-only';
import { lookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

// Only globally routable addresses may be used for user-supplied previews/media.
const privateAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateAddresses.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
// Exclude transition mechanisms and documentation/reserved ranges inside global unicast.
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) privateAddresses.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !privateAddresses.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !privateAddresses.check(address, 'ipv6');
}

function publicUrl(raw: string): URL {
  const url = new URL(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || /(^|\.)(localhost|local|internal)$/i.test(hostname)
    || (isIP(hostname) && !isPublicAddress(hostname))) throw new Error('Only public HTTP URLs are allowed.');
  return url;
}

type Options = { maxBytes: number; timeoutMs?: number; headers?: Record<string, string> };
type Resource = { status: number; type: string; body: Buffer; url: string };

export async function fetchPublicResource(raw: string, options: Options): Promise<Resource> {
  const deadline = Date.now() + (options.timeoutMs ?? 7000);
  let url = publicUrl(raw);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Resource request timed out.');
    const result = await new Promise<Resource & { location?: string }>((resolve, reject) => {
      const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = send(url, {
        // No pooled socket can skip DNS checks; the validated address is used by this connection.
        agent: false,
        headers: { ...options.headers, 'accept-encoding': 'identity' },
        lookup: (hostname, lookupOptions, callback) => {
          lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
            if (error) return callback(error, '', 4);
            if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
              return callback(new Error('Only public HTTP URLs are allowed.'), '', 4);
            }
            const address = addresses[0];
            if (lookupOptions.all) callback(null, addresses);
            else callback(null, address.address, address.family);
          });
        },
      }, (res) => {
        const status = res.statusCode || 0;
        const type = String(res.headers['content-type'] || '');
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.destroy();
          resolve({ status, type, body: Buffer.alloc(0), url: url.href, location });
          return;
        }
        if (Number(res.headers['content-length']) > options.maxBytes) {
          res.destroy();
          reject(new Error('Resource exceeds the size limit.'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            res.destroy();
            reject(new Error('Resource exceeds the size limit.'));
          } else chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, type, body: Buffer.concat(chunks), url: url.href }));
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('Resource response was interrupted.')));
      });
      const timer = setTimeout(() => req.destroy(new Error('Resource request timed out.')), remaining);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
    if (!result.location) return result;
    url = publicUrl(new URL(result.location, url).href);
  }
  throw new Error('Too many resource redirects.');
}
