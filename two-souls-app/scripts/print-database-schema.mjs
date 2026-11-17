import { readFile } from 'node:fs/promises';

const files = [
  new URL('../server/auth/schema.sql', import.meta.url),
  new URL('../db/schema.sql', import.meta.url),
];

for (const file of files) {
  process.stdout.write(await readFile(file, 'utf8'));
  process.stdout.write('\n');
}
