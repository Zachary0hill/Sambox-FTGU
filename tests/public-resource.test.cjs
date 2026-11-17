/* eslint-disable @typescript-eslint/no-require-imports -- Standalone transport regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const ts = require('typescript');
const fs = require('node:fs');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name === 'server-only' ? {} : mocks[name] || require(name), mod, mod.exports);
  return mod.exports;
}
function fixture(responses, addresses = [{ address: '93.184.215.14', family: 4 }]) {
  const requested = [], connected = [], resolved = [];
  function request(url, options, receive) {
    requested.push(url.href);
    const req = new EventEmitter();
    req.destroy = error => { req.emit('error', error); req.emit('close'); };
    req.end = () => queueMicrotask(() => options.lookup(url.hostname, { all: true }, (error, records) => {
      if (error) return req.destroy(error);
      connected.push(records);
      const reply = responses.shift() || {};
      const res = new PassThrough();
      res.statusCode = reply.status || 200;
      res.headers = reply.headers || { 'content-type': 'text/html' };
      res.on('close', () => req.emit('close'));
      receive(res);
      if (!res.destroyed) {
        for (const chunk of reply.chunks || ['hello']) res.write(chunk);
        if (!reply.stall) res.end();
      }
    }));
    return req;
  }
  const api = load('lib/http/public-resource.ts', {
    'node:http': { request }, 'node:https': { request },
    'node:dns': { lookup(host, options, callback) { resolved.push(host); callback(null, typeof addresses === 'function' ? addresses(host) : addresses); } },
  });
  return { ...api, requested, connected, resolved };
}
test('public address classifier rejects private, loopback, metadata, mapped and transition addresses', () => {
  const { isPublicAddress } = fixture([]);
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.100.100.200', '172.31.0.1', '192.168.1.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2002:7f00:1::', '2001:db8::1']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '93.184.215.14', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
});
test('rejects unsafe direct URLs before making a request', async () => {
  const f = fixture([]);
  for (const url of ['http://127.1', 'http://0x7f000001', 'http://[::1]', 'http://localhost.', 'http://foo.internal', 'file:///etc/passwd', 'https://user:pass@example.com']) await assert.rejects(f.fetchPublicResource(url, { maxBytes: 100 }));
  assert.equal(f.requested.length, 0);
});
test('DNS checks happen in connection lookup and reject mixed public/private answers', async () => {
  const f = fixture([], [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.1', family: 4 }]);
  await assert.rejects(f.fetchPublicResource('https://example.com', { maxBytes: 100 }), /public/);
  assert.equal(f.connected.length, 0);
  assert.deepEqual(f.resolved, ['example.com']);
});
test('redirects cannot reach IP literals or hostnames resolving to internal services', async () => {
  const direct = fixture([{ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }]);
  await assert.rejects(direct.fetchPublicResource('https://example.com', { maxBytes: 100 }), /public/);
  assert.equal(direct.requested.length, 1);
  const dns = fixture([{ status: 302, headers: { location: 'http://private.example.com/' } }], host => [{ address: host.startsWith('private') ? '10.0.0.1' : '93.184.215.14', family: 4 }]);
  await assert.rejects(dns.fetchPublicResource('https://example.com', { maxBytes: 100 }), /public/);
  assert.equal(dns.connected.length, 1);
});
test('relative public redirects work and return the final URL', async () => {
  const f = fixture([{ status: 302, headers: { location: '/new/page' } }, { chunks: ['ok'] }]);
  const result = await f.fetchPublicResource('https://example.com/old', { maxBytes: 100 });
  assert.equal(result.url, 'https://example.com/new/page');
  assert.equal(result.body.toString(), 'ok');
  assert.equal(f.resolved.length, 2);
});
test('declared and streamed oversized bodies are rejected', async () => {
  for (const reply of [{ headers: { 'content-length': '101' } }, { chunks: ['a'.repeat(60), 'b'.repeat(60)] }]) {
    await assert.rejects(fixture([reply]).fetchPublicResource('https://example.com', { maxBytes: 100 }), /size limit/);
  }
});
test('stalled response body is bounded by the overall deadline', async () => {
  await assert.rejects(fixture([{ stall: true }]).fetchPublicResource('https://example.com', { maxBytes: 100, timeoutMs: 20 }), /timed out/);
});
test('unfurl uses final URL for images and tolerates invalid numeric entities', async () => {
  const { POST } = load('app/api/unfurl/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/integrations/auth': { getMember: async () => ({}) },
    '@/lib/http/public-resource': { fetchPublicResource: async () => ({ status: 200, type: 'text/html', url: 'https://example.com/new/page', body: Buffer.from('<title>Hello &#999999999;</title><meta property="og:image" content="thumb.jpg">') }) },
  });
  const response = await POST(new Request('https://studio.test/api/unfurl', { method: 'POST', body: JSON.stringify({ urls: ['https://example.com/old'] }) }));
  const p = (await response.json()).previews['https://example.com/old'];
  assert.equal(p.image, 'https://example.com/new/thumb.jpg');
  assert.equal(p.title, 'Hello \uFFFD');
});
