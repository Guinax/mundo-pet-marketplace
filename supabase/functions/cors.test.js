import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

for (const slug of ['mp-delivery-quote', 'mp-secure-checkout', 'mp-infinitepay']) {
  test(`${slug}: browser SDK preflight accepts every requested header`, async () => {
    const source = readFileSync(new URL(`./${slug}/index.ts`, import.meta.url), 'utf8')
      .replace(/^import .*?;\n/, '');
    let handler;
    vm.runInNewContext(stripTypeScriptTypes(source), {
      Deno: { env: { get: () => undefined }, serve: fn => { handler = fn; } },
      Response, console,
    });
    const requested = ['authorization', 'apikey', 'content-type', 'x-client-info'];
    const response = await handler(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { Origin: 'https://mundo-pet-marketplace.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': requested.join(',') },
    }));
    assert.equal(response.status, 200);
    const allowed = response.headers.get('access-control-allow-headers').toLowerCase().split(',').map(x => x.trim());
    for (const header of requested) assert.ok(allowed.includes(header), `Missing CORS header ${header}`);
    assert.ok(response.headers.get('access-control-allow-methods').includes('POST'));
  });
}
