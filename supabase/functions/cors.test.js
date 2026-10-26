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
  test(`${slug}: records Google rejection without copying provider messages or credentials`, async () => {
    const source = readFileSync(new URL(`./${slug}/index.ts`, import.meta.url), 'utf8').replace(/^import .*?;\n/, '');
    const product = '11111111-1111-4111-8111-111111111111';
    const store = '22222222-2222-4222-8222-222222222222';
    const values = { GOOGLE_MAPS_API_KEY: 'fixture-private-key', SUPABASE_URL: 'https://example.test',
      SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'server-fixture' };
    let handler;
    const messages = [];
    const record = (...args) => messages.push(JSON.stringify(args));
    const database = {
      auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
      from: table => {
        const chain = { select: () => chain, eq: () => chain,
          in: async () => ({ data: [{ id: product, store_id: store }] }),
          maybeSingle: async () => ({ data: table === 'mp_stores'
            ? { id: store, address: 'Public fixture origin', is_open: true, is_demo: false }
            : { address: { street: 'Fixture', number: '1', city: 'Fixture', state: 'SP' } } }) };
        return chain;
      },
    };
    vm.runInNewContext(stripTypeScriptTypes(source), {
      Deno: { env: { get: name => values[name] }, serve: fn => { handler = fn; } },
      createClient: () => database, Response, AbortSignal,
      console: { info: record, error: record },
      fetch: async () => new Response(JSON.stringify({ error: {
        status: 'PERMISSION_DENIED', message: 'Never log fixture-private-key',
        details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }],
      } }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: store, cart: [{ product_id: product, quantity: 1 }],
        request_id: '33333333-3333-4333-8333-333333333333', payment_method: 'infinitepay_pix' }),
    }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).provider_status, 403);
    assert.ok(messages.join('').includes('API_KEY_SERVICE_BLOCKED'));
    assert.ok(!messages.join('').includes('fixture-private-key'));
  });
  for (const [label, credential] of [
    ['standard secret name', { GOOGLE_MAPS_API_KEY: '  fixture-google-key  ' }],
    ['space-separated secret name', { 'GOOGLE MAPS API KEY': 'fixture-google-key' }],
    ['missing secret', {}],
    ['digest accidentally stored', { GOOGLE_MAPS_API_KEY: 'a'.repeat(64) }],
    ['valid alternate over digest', { GOOGLE_MAPS_API_KEY: 'a'.repeat(64), 'GOOGLE MAPS API KEY': 'fixture-google-key' }],
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
      if (['missing secret', 'digest accidentally stored'].includes(label)) {
        assert.equal(response.status, 503);
        assert.equal(body.error, label === 'missing secret' ? 'maps_not_configured' : 'maps_credential_invalid');
      } else {
        assert.equal(response.status, 400);
        assert.equal(body.error, slug === 'mp-delivery-quote' ? 'invalid_store' : 'invalid_checkout');
      }
      assert.ok(!messages.join('').includes('fixture-google-key'));
    });
  }
}
