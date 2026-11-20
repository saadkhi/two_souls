import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { routeSegments } from '../api/index.js';
import { actionInternals } from '../server/actions.js';
import { uploadInternals } from '../server/uploads.js';

const root = new URL('..', import.meta.url);
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

function createVercelConfig() {
  return structuredClone(vercelConfig);
}

function compile() {
  const result = getTransformedRoutes(createVercelConfig());
  assert.equal(result.error, null);
  return result.routes;
}

function destination(routes, path) {
  const pathname = new URL(path, 'https://store.example').pathname;
  const route = routes.find(item => item.dest && new RegExp(item.src).test(pathname));
  return route ? pathname.replace(new RegExp(route.src), route.dest) : null;
}

function cacheControl(routes, path) {
  return routes.filter(item => item.headers && new RegExp(item.src).test(path))
    .map(item => item.headers['Cache-Control']).filter(Boolean);
}

test('Vercel compiles one Vite app and one same-origin Node API', async () => {
  const config = createVercelConfig();
  compile();
  assert.equal(config.framework, 'vite');
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.name, 'two-souls-vercel-storefront');
  assert.equal(pkg.engines.node, '24.x');
  await access(new URL('../api/index.js', import.meta.url));
});

test('all API surfaces route to the local Function before the SPA fallback', () => {
  const routes = compile();
  for (const path of [
    '/api/public/settings', '/api/auth/login', '/api/auth/mfa/exchange',
    '/api/entities/Product/query', '/api/entities/Order/example',
    '/api/actions/placeOrder', '/api/actions/trackOrder',
    '/api/uploads/public', '/api/uploads/private/example',
  ]) {
    const expected = `/api?path=${path.slice('/api/'.length)}`;
    assert.equal(destination(routes, path), expected, path);
  }
  assert.ok(!routes.some(route => /^https?:/.test(route.dest || '')), 'API must not proxy to another application');
});

test('storefront, account and nested admin deep links receive the SPA entry point', () => {
  const routes = compile();
  for (const path of [
    '/', '/shop', '/product/noir-oud', '/cart', '/checkout', '/order-confirmation',
    '/about', '/policies', '/track', '/wishlist', '/account', '/login', '/register',
    '/forgot-password', '/reset-password?token=example', '/mfa', '/admin',
    '/admin/products', '/admin/orders', '/admin/inventory', '/admin/customers',
    '/admin/payments', '/admin/shipping', '/admin/marketing', '/admin/content',
    '/admin/reviews', '/admin/reports', '/admin/settings', '/unknown-route',
  ]) assert.equal(destination(routes, path), '/index.html', path);
});

test('real or missing assets never fall through to HTML', () => {
  const routes = compile();
  assert.ok(routes.findIndex(item => item.handle === 'filesystem') < routes.findIndex(item => item.dest));
  for (const path of [
    '/assets/index-abc.js', '/media/studio-small-03-2k.hdr', '/media/missing.mp4',
    '/films/noir-oud.mp4', '/films/missing-poster.png', '/catalog/noir-oud.png',
  ]) assert.equal(destination(routes, path), null, path);
});

test('cache policy separates hashed assets, API responses, catalog and HTML', () => {
  const routes = compile();
  assert.deepEqual(cacheControl(routes, '/assets/three-abc.js'), ['public, max-age=31536000, immutable']);
  assert.deepEqual(cacheControl(routes, '/api/auth/session'), ['private, no-store']);
  assert.deepEqual(cacheControl(routes, '/catalog/noir-oud.png'), ['public, max-age=86400, must-revalidate']);
  for (const path of ['/index.html', '/checkout', '/media/studio-small-03-2k.hdr', '/films/noir-oud.mp4']) {
    assert.deepEqual(cacheControl(routes, path), ['public, max-age=0, must-revalidate']);
  }
});

test('API route decoding is bounded and rejects traversal', () => {
  assert.deepEqual(routeSegments(new Request('https://store.example/api?path=entities/Product/query')), ['entities', 'Product', 'query']);
  assert.deepEqual(routeSegments(new Request('https://store.example/api/auth/session')), ['auth', 'session']);
  assert.throws(() => routeSegments(new Request('https://store.example/api?path=../secret')), /Invalid API path/);
  assert.throws(() => routeSegments(new Request(`https://store.example/api?path=${'x'.repeat(501)}`)), /Invalid API path/);
});

test('receipt decoder checks MIME, byte size and file signature', () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const valid = uploadInternals.decodeUpload({
    name: 'receipt.png', type: 'image/png', size: bytes.length,
    data: `data:image/png;base64,${bytes.toString('base64')}`,
  }, 'private');
  assert.equal(valid.extension, 'png');
  assert.equal(valid.bytes.length, bytes.length);
  assert.throws(() => uploadInternals.decodeUpload({
    name: 'fake.png', type: 'image/png', size: 4, data: 'data:image/png;base64,ZmFrZQ==',
  }, 'private'), /contents do not match/);
});

test('commerce helpers keep totals server-controlled', () => {
  assert.equal(actionInternals.calculateDiscount({ type: 'percentage', value: 10 }, 12_000), 1_200);
  assert.equal(actionInternals.calculateDiscount({ type: 'fixed', value: 20_000 }, 12_000), 12_000);
  const quote = actionInternals.shippingQuote(
    { city: 'Lahore', province: 'Punjab', shippingMethod: 'standard' },
    { freeShippingThreshold: 5_000, standardShippingFee: 350, taxEnabled: true, taxInclusive: false, defaultTaxRate: 10, paymentMethods: { cod: { fee: 150 } } },
    [], 10_000, 1_000, 'cod',
  );
  assert.deepEqual(quote, { city: 'Lahore', province: 'Punjab', shippingFee: 0, codFee: 150, taxAmount: 900, total: 10_050 });
});

async function sourceFiles(directory) {
  const ignored = new Set(['.git', 'node_modules', 'dist']);
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.filter(entry => !ignored.has(entry.name)).map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }))).flat();
}

test('legacy SDK, proxy settings and platform configuration are absent', async () => {
  const removedPlatform = ['base', '44'].join('');
  const packageText = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const lockText = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8');
  assert.ok(!packageText.toLowerCase().includes(removedPlatform));
  assert.ok(!lockText.toLowerCase().includes(removedPlatform));
  await assert.rejects(access(new URL(`../${removedPlatform}/`, import.meta.url)));
  await assert.rejects(access(new URL('../.openai/hosting.json', import.meta.url)));

  const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.jsonc', '.md', '.mjs', '.sql', '.txt', '.yaml', '.yml']);
  for (const file of await sourceFiles(fileURLToPath(new URL('..', import.meta.url)))) {
    if (!textExtensions.has(extname(file)) && !['.env.example', '.gitignore', '.vercelignore'].some(name => file.endsWith(name))) continue;
    const text = await readFile(file, 'utf8');
    assert.ok(!text.toLowerCase().includes(removedPlatform), `Legacy identifier remains in ${file}`);
  }
});

test('environment template contains server-only deployment variables', async () => {
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  for (const key of ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'APP_URL', 'DATA_ENCRYPTION_KEY', 'ADMIN_EMAILS', 'RESEND_API_KEY', 'GOOGLE_CLIENT_ID']) {
    assert.match(env, new RegExp(`^${key}=`, 'm'));
  }
  assert.doesNotMatch(env, /^VITE_.*(?:SECRET|TOKEN|PASSWORD|KEY)=/m);
});
