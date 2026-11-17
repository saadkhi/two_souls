const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class StoreApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'StoreApiError';
    this.status = status;
    this.data = data;
    // Existing screens read the function error through this Axios-shaped field.
    this.response = { status, data };
  }
}

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? headers : { ...JSON_HEADERS, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.detail || data?.message || `Request failed (${response.status})`;
    throw new StoreApiError(message, response.status, data);
  }
  return data;
}

function page(result) {
  const rows = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
  if (!Object.prototype.hasOwnProperty.call(rows, 'items')) {
    Object.defineProperty(rows, 'items', { value: rows, configurable: true });
  }
  return rows;
}

const entity = (name) => ({
  filter: async (query = {}, options = {}) => page(await request(`/api/entities/${encodeURIComponent(name)}/query`, {
    method: 'POST', body: { query, options },
  })),
  list: async (options = {}) => page(await request(`/api/entities/${encodeURIComponent(name)}/query`, {
    method: 'POST', body: { query: {}, options },
  })),
  get: (id) => request(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`),
  create: (data) => request(`/api/entities/${encodeURIComponent(name)}`, { method: 'POST', body: data }),
  update: (id, data) => request(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  bulkCreate: (records) => request(`/api/entities/${encodeURIComponent(name)}/bulk`, { method: 'POST', body: { records } }),
  count: async (query = {}) => {
    const result = await request(`/api/entities/${encodeURIComponent(name)}/count`, { method: 'POST', body: { query } });
    return Number(result?.count ?? result ?? 0);
  },
});

const encodeFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the selected file.'));
  reader.onload = () => resolve({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    data: reader.result,
  });
  reader.readAsDataURL(file);
});

async function upload(file, access) {
  if (!(file instanceof File)) throw new TypeError('A file is required.');
  return request(`/api/uploads/${access}`, { method: 'POST', body: await encodeFile(file) });
}

function localReturnTo(value) {
  try {
    const url = new URL(value || '/', window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export const storeApi = {
  app: {
    getPublicSettings: () => request('/api/public/settings'),
  },
  auth: {
    me: () => request('/api/auth/session'),
    register: ({ email, password }) => request('/api/auth/register', { method: 'POST', body: { email, password } }),
    verifyOtp: ({ email, otpCode }) => request('/api/auth/verify-email', { method: 'POST', body: { email, code: otpCode } }),
    resendOtp: (email) => request('/api/auth/resend-verification', { method: 'POST', body: { email } }),
    resetPasswordRequest: (email) => request('/api/auth/password-reset/request', { method: 'POST', body: { email } }),
    resetPassword: ({ resetToken, newPassword }) => request('/api/auth/password-reset/confirm', {
      method: 'POST', body: { token: resetToken, newPassword },
    }),
    // Sessions are stored in a Secure HttpOnly cookie. This remains for the
    // existing registration and MFA screens, which do not need browser tokens.
    setToken: () => {},
    logout: async (redirectUrl) => {
      try { await request('/api/auth/logout', { method: 'POST', body: {} }); }
      finally { if (redirectUrl) window.location.assign(localReturnTo(redirectUrl)); }
    },
    redirectToLogin: (returnTo) => {
      const path = localReturnTo(returnTo);
      window.location.assign(`/login${path === '/' ? '' : `?returnTo=${encodeURIComponent(path)}`}`);
    },
    loginWithProvider: (provider, returnTo = '/', options = {}) => {
      const query = new URLSearchParams({ returnTo: localReturnTo(returnTo) });
      if (options.manage) query.set('manage', '1');
      window.location.assign(`/api/auth/oauth/${encodeURIComponent(provider)}/start?${query}`);
    },
    isAuthenticated: async () => {
      try { await request('/api/auth/session'); return true; } catch { return false; }
    },
  },
  entities: new Proxy({}, { get: (_target, name) => entity(String(name)) }),
  functions: {
    invoke: async (name, body) => {
      const result = await request(`/api/actions/${encodeURIComponent(name)}`, { method: 'POST', body });
      return { data: result?.data ?? result };
    },
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }) => upload(file, 'public'),
      UploadPrivateFile: async ({ file }) => upload(file, 'private'),
    },
  },
};

export { request as storeRequest };
