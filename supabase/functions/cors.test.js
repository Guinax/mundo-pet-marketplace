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

for (const slug of ['mp-delivery-quote', 'mp-secure-checkout']) {
  for (const [label, credential] of [
    ['standard secret name', { GOOGLE_MAPS_API_KEY: '  fixture-google-key  ' }],
    ['space-separated secret name', { 'GOOGLE MAPS API KEY': 'fixture-google-key' }],
    ['missing secret', {}],
  ]) {
    test(`${slug}: handles ${label} without logging its value`, async () => {
      const source = readFileSync(new URL(`./${slug}/index.ts`, import.meta.url), 'utf8')
        .replace(/^import .*?;\n/, '');
      const values = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'public-fixture',
        SUPABASE_SERVICE_ROLE_KEY: 'server-fixture', ...credential };
      let handler;
      const messages = [];
      const record = (...args) => messages.push(JSON.stringify(args));
      vm.runInNewContext(stripTypeScriptTypes(source), {
        Deno: { env: { get: name => values[name] }, serve: fn => { handler = fn; } },
        createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) } }),
        Response, console: { info: record, error: record },
      });
      const response = await handler(new Request('https://example.test', {
        method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: 'invalid' }),
      }));
      const body = await response.json();
      if (label === 'missing secret') {
        assert.equal(response.status, 503);
        assert.equal(body.error, 'maps_not_configured');
      } else {
        assert.equal(response.status, 400);
        assert.equal(body.error, slug === 'mp-delivery-quote' ? 'invalid_store' : 'invalid_checkout');
      }
      assert.ok(!messages.join('').includes('fixture-google-key'));
    });
  }
}
