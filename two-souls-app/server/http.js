export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function errorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'The server could not complete this request.'
    : error?.message || 'The server could not complete this request.';
  if (status >= 500) console.error(error);
  return json({ error: message, ...(error?.details ? { details: error.details } : {}) }, status, error?.retryAfter
    ? { 'Retry-After': String(error.retryAfter) } : {});
}

export async function readJson(request, maximumBytes = 1_000_000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maximumBytes) throw new HttpError(413, 'This request is too large.');
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new HttpError(415, 'Send this request as JSON.');
  try { return await request.json(); } catch { throw new HttpError(400, 'The request body is not valid JSON.'); }
}

export function requireMethod(request, ...methods) {
  if (!methods.includes(request.method)) {
    throw new HttpError(405, 'Method not allowed.', { allowed: methods });
  }
}

export function requestOrigin(request) {
  const configured = process.env.APP_URL;
  if (configured) return new URL(configured).origin;
  const forwarded = request.headers.get('x-forwarded-host');
  const host = forwarded || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : new URL(request.url).origin;
}

export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const allowed = new Set([requestOrigin(request), new URL(request.url).origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  if (origin && !allowed.has(origin)) throw new HttpError(403, 'Cross-origin request rejected.');
}

export function safePath(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
