import { invokeAction } from '../server/actions.js';
import { getSessionUser, handleAuth } from '../server/auth/index.js';
import {
  bulkCreateRecords,
  countRecords,
  createRecord,
  deleteRecord,
  getRecord,
  queryRecords,
  updateRecord,
} from '../server/entities.js';
import { assertSameOrigin, errorResponse, HttpError, json, readJson } from '../server/http.js';
import { downloadPrivateFile, uploadFile } from '../server/uploads.js';

function routeSegments(request) {
  const url = new URL(request.url);
  const rewritten = url.searchParams.get('path');
  const path = rewritten == null ? url.pathname.replace(/^\/api\/?/, '') : rewritten;
  if (path.includes('..') || path.includes('\\') || path.length > 500) throw new HttpError(400, 'Invalid API path.');
  return path.split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch { throw new HttpError(400, 'Invalid API path.'); }
  });
}

async function entityResponse(request, segments, user) {
  const [entity, operation] = segments;
  if (!entity) throw new HttpError(404, 'Data endpoint not found.');

  if (operation === 'query') {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const input = await readJson(request);
    const options = input.options && typeof input.options === 'object'
      ? { sort: input.options.sort, limit: input.options.limit }
      : {};
    return json({ items: await queryRecords(entity, input.query || {}, options, user) });
  }
  if (operation === 'count') {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const input = await readJson(request);
    return json({ count: await countRecords(entity, input.query || {}, user) });
  }
  if (operation === 'bulk') {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const input = await readJson(request, 2_000_000);
    return json({ items: await bulkCreateRecords(entity, input.records, user) }, 201);
  }
  if (segments.length > 2) throw new HttpError(404, 'Data endpoint not found.');
  if (!operation) {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    return json(await createRecord(entity, await readJson(request), user), 201);
  }
  if (request.method === 'GET') return json(await getRecord(entity, operation, user));
  if (request.method === 'PATCH') return json(await updateRecord(entity, operation, await readJson(request), user));
  if (request.method === 'DELETE') return json(await deleteRecord(entity, operation, user));
  throw new HttpError(405, 'Method not allowed.');
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, PATCH, DELETE, OPTIONS' } });
  const segments = routeSegments(request);
  if (segments[0] === 'auth') return handleAuth(request, segments.slice(1));
  if (segments[0] === 'public' && segments[1] === 'settings') return handleAuth(request, ['public-settings']);

  assertSameOrigin(request);
  const user = await getSessionUser(request);
  if (segments[0] === 'entities') return entityResponse(request, segments.slice(1), user);
  if (segments[0] === 'actions' && segments.length === 2) {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    return json(await invokeAction(segments[1], await readJson(request, 1_000_000), user));
  }
  if (segments[0] === 'uploads' && segments.length === 2) {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    return json(await uploadFile(request, segments[1], user), 201);
  }
  if (segments[0] === 'uploads' && segments[1] === 'private' && segments.length === 3) {
    if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    return downloadPrivateFile(segments[2], user, request);
  }
  if (!segments.length && request.method === 'GET') return json({ ok: true, service: 'two-souls-api' });
  throw new HttpError(404, 'API endpoint not found.');
}

export default {
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

export { handleRequest, routeSegments };
