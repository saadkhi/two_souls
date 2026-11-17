import { randomUUID } from 'node:crypto';
import { ensureDatabase, getDatabase } from './db.js';
import { normalizeEmail } from './security.js';

export const ENTITY_NAMES = Object.freeze([
  'Address', 'AuditLog', 'BusinessSettings', 'CodSettlement', 'Collection', 'Coupon', 'CourierAccount',
  'CustomerProfile', 'InventoryLog', 'NewsletterSubscriber', 'Order', 'Payment', 'Product', 'Promotion',
  'Review', 'ShippingZone', 'SiteContent',
]);
const entities = new Set(ENTITY_NAMES);
const publicRead = new Set(['Product', 'Collection', 'BusinessSettings', 'SiteContent', 'Promotion', 'ShippingZone']);
const publicCreate = new Set(['NewsletterSubscriber', 'Review']);
export const SYSTEM_USER = Object.freeze({ id: null, email: 'system', role: 'system' });

function fail(message, status = 403) { throw Object.assign(new Error(message), { status }); }
function validEntity(value) { if (!entities.has(value)) fail('Unknown data collection.', 404); return value; }
const privileged = user => user?.role === 'admin' || user?.role === 'system';
const shape = row => row ? ({
  ...(row.data || {}), id: row.id,
  created_date: new Date(row.created_at).toISOString(), updated_date: new Date(row.updated_at).toISOString(),
  created_by_id: row.created_by_id || null,
}) : null;
async function executor(client) { if (client) return client; await ensureDatabase(); return getDatabase(); }

function readScope(entity, user, sql) {
  if (privileged(user) || publicRead.has(entity)) return sql``;
  if (entity === 'Review') return sql`and data->>'status' = 'approved'`;
  if (!user) fail('Sign in required.', 401);
  if (entity === 'Order') return sql`and lower(coalesce(data->>'userEmail', '')) = ${normalizeEmail(user.email)}`;
  if (entity === 'Address') return sql`and created_by_id = ${user.id}`;
  if (entity === 'CustomerProfile') return sql`and lower(coalesce(data->>'userEmail', '')) = ${normalizeEmail(user.email)}`;
  fail('You do not have access to this data.');
}
function canCreate(entity, user) {
  if (privileged(user) || publicCreate.has(entity) || (entity === 'Address' && user)) return;
  fail(user ? 'You do not have permission to add this data.' : 'Sign in required.', user ? 403 : 401);
}
function canMutate(entity, row, user) {
  if (privileged(user)) return;
  if (!user) fail('Sign in required.', 401);
  if (entity === 'Address' && row.created_by_id === user.id) return;
  if (entity === 'CustomerProfile' && normalizeEmail(row.data?.userEmail) === normalizeEmail(user.email)) return;
  fail('You do not have permission to change this data.');
}
function cleanData(entity, value, user) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
  for (const key of ['id', 'created_date', 'updated_date', 'created_by_id']) delete data[key];
  if (!privileged(user)) {
    if (entity === 'Review') data.status = 'pending';
    if (entity === 'NewsletterSubscriber') {
      data.email = normalizeEmail(data.email); data.active = data.active !== false;
      data.source = String(data.source || 'website').slice(0, 60);
    }
    if (entity === 'CustomerProfile') data.userEmail = normalizeEmail(user?.email);
  }
  return data;
}
function compare(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$in' in expected) return Array.isArray(expected.$in) && expected.$in.some(value => Object.is(actual, value));
    if ('$regex' in expected) {
      try { return new RegExp(String(expected.$regex).slice(0, 200), String(expected.$options || '').includes('i') ? 'i' : '').test(String(actual ?? '')); }
      catch { return false; }
    }
    if ('$gte' in expected && !(actual >= expected.$gte)) return false;
    if ('$lte' in expected && !(actual <= expected.$lte)) return false;
    if ('$gte' in expected || '$lte' in expected) return true;
  }
  return Object.is(actual, expected);
}
function matches(record, query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) fail('Invalid query.', 400);
  const fields = Object.entries(query); if (fields.length > 30) fail('Query has too many fields.', 400);
  return fields.every(([key, value]) => {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) fail('Invalid query field.', 400);
    return compare(record[key], value);
  });
}
function sortRows(rows, sort) {
  if (!sort) return rows;
  const descending = String(sort).startsWith('-'), key = String(sort).replace(/^-/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) fail('Invalid sort field.', 400);
  return rows.sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const result = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : Number(x > y) - Number(x < y);
    return descending ? -result : result;
  });
}

export async function queryRecords(entity, query = {}, options = {}, user = null, client) {
  entity = validEntity(entity); const sql = await executor(client), scope = readScope(entity, user, sql);
  const rows = options.lock === 'update'
    ? await sql`select id, data, created_by_id, created_at, updated_at from records where entity = ${entity} ${scope} for update`
    : await sql`select id, data, created_by_id, created_at, updated_at from records where entity = ${entity} ${scope}`;
  const limit = Math.max(0, Math.min(1000, Number(options.limit) || 200));
  return sortRows(rows.map(shape).filter(record => matches(record, query)), options.sort).slice(0, limit);
}
async function rawById(entity, id, sql) {
  const rows = await sql`select id, data, created_by_id, created_at, updated_at from records where entity = ${entity} and id = ${String(id)} limit 1`;
  return rows[0] || null;
}
export async function getRecord(entity, id, user = null, client) {
  entity = validEntity(entity); const sql = await executor(client), scope = readScope(entity, user, sql);
  const rows = await sql`select id, data, created_by_id, created_at, updated_at from records where entity = ${entity} and id = ${String(id)} ${scope} limit 1`;
  if (!rows[0]) fail('Record not found.', 404); return shape(rows[0]);
}
export async function createRecord(entity, value, user = null, client, requestedId) {
  entity = validEntity(entity); canCreate(entity, user); const sql = await executor(client), data = cleanData(entity, value, user);
  if (entity === 'NewsletterSubscriber') {
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) fail('Enter a valid email address.', 400);
    const existing = await sql`select id, data, created_by_id, created_at, updated_at from records where entity = 'NewsletterSubscriber' and lower(data->>'email') = ${data.email} limit 1`;
    if (existing[0]) return shape(existing[0]);
  }
  if (entity === 'Review') {
    if (Number(data.rating) < 1 || Number(data.rating) > 5) fail('Rating must be between 1 and 5.', 400);
    data.body = String(data.body || '').trim().slice(0, 4000);
  }
  const rows = await sql`insert into records (id, entity, data, created_by_id)
    values (${String(requestedId || randomUUID())}, ${entity}, ${sql.json(data)}, ${user?.id || null})
    returning id, data, created_by_id, created_at, updated_at`;
  return shape(rows[0]);
}
export async function updateRecord(entity, id, patch, user = null, client) {
  entity = validEntity(entity); const sql = await executor(client), current = await rawById(entity, id, sql);
  if (!current) fail('Record not found.', 404); canMutate(entity, current, user);
  const data = { ...(current.data || {}), ...cleanData(entity, patch, user) };
  const rows = await sql`update records set data = ${sql.json(data)}, updated_at = now()
    where entity = ${entity} and id = ${String(id)} returning id, data, created_by_id, created_at, updated_at`;
  return shape(rows[0]);
}
export async function deleteRecord(entity, id, user = null, client) {
  entity = validEntity(entity); const sql = await executor(client), current = await rawById(entity, id, sql);
  if (!current) fail('Record not found.', 404); canMutate(entity, current, user);
  await sql`delete from records where entity = ${entity} and id = ${String(id)}`;
  return { id: String(id), deleted: true };
}
export async function bulkCreateRecords(entity, values, user = null, client) {
  if (!Array.isArray(values) || values.length > 500) fail('Bulk data must contain at most 500 records.', 400);
  const output = []; for (const value of values) output.push(await createRecord(entity, value, user, client)); return output;
}
export async function countRecords(entity, query = {}, user = null, client) {
  entity = validEntity(entity);
  const sql = await executor(client);
  const scope = readScope(entity, user, sql);
  const rows = await sql`select id, data, created_by_id, created_at, updated_at
    from records where entity = ${entity} ${scope}`;
  return rows.map(shape).filter(record => matches(record, query)).length;
}

export function createEntityStore({ client, privileged: bypass = false, user = null } = {}) {
  const defaultActor = bypass ? SYSTEM_USER : user;
  return {
    query: (entity, query, options) => queryRecords(entity, query, options, defaultActor, client),
    get: (entity, id) => getRecord(entity, id, defaultActor, client),
    create: (entity, data, actor = defaultActor) => createRecord(entity, data, bypass ? { ...actor, role: 'system' } : actor, client),
    update: (entity, id, patch) => updateRecord(entity, id, patch, defaultActor, client),
    delete: (entity, id) => deleteRecord(entity, id, defaultActor, client),
    bulkCreate: (entity, rows, actor = defaultActor) => bulkCreateRecords(entity, rows, bypass ? { ...actor, role: 'system' } : actor, client),
    count: (entity, query) => countRecords(entity, query, defaultActor, client),
  };
}
