import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat();
}

const html = await readFile(resolve(dist, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)[^"]*"/g)) {
  assert.ok((await stat(resolve(dist, `.${match[1]}`))).isFile(), `Missing HTML asset: ${match[1]}`);
}
const manifest = JSON.parse(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'));
assert.ok(Object.values(manifest).some(chunk => chunk.isEntry), 'Build has no entry chunk');
for (const chunk of Object.values(manifest)) {
  for (const path of [chunk.file, ...(chunk.css || []), ...(chunk.assets || [])]) {
    assert.ok((await stat(resolve(dist, path))).isFile(), `Missing bundle dependency: ${path}`);
  }
  for (const key of [...(chunk.imports || []), ...(chunk.dynamicImports || [])]) {
    assert.ok(manifest[key], `Unresolved chunk: ${key}`);
  }
}

const publicFiles = await files(resolve(root, 'public'));
for (const file of publicFiles) {
  const name = relative(resolve(root, 'public'), file);
  assert.ok((await readFile(file)).equals(await readFile(resolve(dist, name))), `Public asset changed or omitted: ${name}`);
}

for (const required of ['api/index.js', 'server/auth/index.js', 'server/actions.js', 'server/entities.js', 'server/uploads.js', 'db/schema.sql']) {
  assert.ok((await stat(resolve(root, required))).isFile(), `Missing server source: ${required}`);
}

const outputFiles = await files(dist);
let total = 0;
for (const file of outputFiles) {
  const name = relative(dist, file).replaceAll('\\', '/');
  assert.ok(!/(^|\/)(node_modules|server|api|\.env[^/]*)(\/|$)/.test(name), `Unexpected private/server file: ${name}`);
  assert.ok(!name.endsWith('.map'), `Unexpected public source map: ${name}`);
  total += (await stat(file)).size;
}

const catalogCount = publicFiles.filter(file => file.includes(`${resolve(root, 'public', 'catalog')}/`)).length;
assert.ok(catalogCount >= 10, 'Localized catalog assets are incomplete');
console.log(`Deployment build verified: ${outputFiles.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB; all ${publicFiles.length} public assets preserved byte-for-byte.`);
