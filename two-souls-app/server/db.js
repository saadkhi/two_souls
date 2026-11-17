import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONTENT, DEFAULT_SETTINGS, SAMPLE_COLLECTIONS, SAMPLE_PRODUCTS, SAMPLE_REVIEWS } from '../src/lib/defaults.js';

let database;
let ready;

export function getDatabase() {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw Object.assign(new Error('Connect a Postgres database in the Vercel project settings.'), { status: 503, code: 'DATABASE_NOT_CONFIGURED' });
  database = postgres(connectionString, {
    max: Math.max(1, Math.min(10, Number(process.env.DATABASE_POOL_SIZE) || 5)),
    idle_timeout: 20, connect_timeout: 15, max_lifetime: 60 * 30, prepare: false,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : 'require',
  });
  return database;
}

async function seedRecord(sql, id, entity, data) {
  await sql`insert into records (id, entity, data) values (${id}, ${entity}, ${sql.json(data)}) on conflict (id) do nothing`;
}
async function seed(sql) {
  await seedRecord(sql, 'settings-main', 'BusinessSettings', { key: 'main', ...DEFAULT_SETTINGS });
  await seedRecord(sql, 'content-main', 'SiteContent', { key: 'main', ...DEFAULT_CONTENT });
  for (const [index, item] of SAMPLE_COLLECTIONS.entries()) {
    await seedRecord(sql, item.id, 'Collection', { ...item, active: item.active ?? true, position: item.position ?? index });
  }
  for (const item of SAMPLE_PRODUCTS) await seedRecord(sql, item.id, 'Product', item);
  for (const item of SAMPLE_REVIEWS) await seedRecord(sql, item.id, 'Review', item);
  await seedRecord(sql, 'shipping-pakistan', 'ShippingZone', {
    name: 'Pakistan standard delivery', zoneType: 'standard', cities: [], provinces: [],
    fee: Number(DEFAULT_SETTINGS.standardShippingFee || 0), expressFee: Number(DEFAULT_SETTINGS.expressShippingFee || 0),
    codAvailable: true, codFee: Number(DEFAULT_SETTINGS.codFee || 0), minDays: 2, maxDays: 5, active: true,
  });
}
async function initialize() {
  const sql = getDatabase();
  await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await seed(sql); return sql;
}
export function ensureDatabase() {
  ready ||= initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
export async function withTransaction(task) {
  await ensureDatabase();
  return getDatabase().begin(async client => task(client));
}
export async function closeDatabase() {
  if (database) await database.end({ timeout: 5 });
  database = undefined; ready = undefined;
}
