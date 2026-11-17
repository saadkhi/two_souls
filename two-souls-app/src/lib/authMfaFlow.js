import { storeApi } from '@/api/storeClient';

// MFA credentials remain in memory. Sign-in sessions use Secure HttpOnly
// cookies and are never exposed through a URL or browser storage.

export class MfaError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
  get mustSignInAgain() {
    return this.status === 401;
  }
}

async function request(suffix, { method = 'POST', body, token, headers } = {}) {
  const response = await fetch(`/api/auth/${suffix}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message || result.error || result.detail || 'Something went wrong. Try again.';
    throw new MfaError(message, response.status, Number(response.headers.get('Retry-After')) || null);
  }
  return result;
}

export function mfaSession(challenge) {
  let credential = challenge.mfa_session_token || challenge.mfa_management_token;
  const call = async (suffix, body, method) => {
    const result = await request(`mfa/${suffix}`, { method, body, token: credential });
    if (result.mfa_management_token) credential = result.mfa_management_token;
    if (result.mfa_session_token) credential = result.mfa_session_token;
    if (result.access_token) storeApi.auth.setToken(result.access_token);
    return result;
  };
  return {
    verify: (code, method, rememberDevice) => call('verify', { code, method, remember_device: rememberDevice }),
    sendSignInCode: () => call('resend'),
    setupAuthenticator: () => call('totp/setup', {}),
    confirmAuthenticator: (code, rememberDevice = false) => call('totp/verify', { code, remember_device: rememberDevice }),
    sendPhoneCode: phoneNumber => call('sms/send-code', { phone_number: phoneNumber }),
    confirmPhone: (code, rememberDevice = false) => call('sms/verify', { code, remember_device: rememberDevice }),
    status: () => call('status', undefined, 'GET'),
    sendProofCode: () => call('sms/send-code', { phone_number: '' }),
    removeMethod: (method, code, proofMethod) => call('disable', { method, code, verification_method: proofMethod }),
    forgetDevices: (code, proofMethod) => call('trusted-devices/clear', { code, method: proofMethod }),
  };
}

export function signInToManageMfa(email, password) {
  return request('login', { body: { email, password, manage: true } });
}

let resumed;

export function resumeMfa() {
  resumed ||= (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('mfa_code');
    if (!code) return null;
    params.delete('mfa_code');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    const result = await request('mfa/exchange', { body: { code } });
    if (result.access_token) storeApi.auth.setToken(result.access_token);
    return result;
  })();
  return resumed;
}

export async function loadSignInOptions() {
  const response = await fetch('/api/auth/providers', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load sign-in options');
  return response.json();
}

export async function signInWithProvider(provider, returnTo, { manage = false } = {}) {
  const info = await loadSignInOptions();
  const options = info.auth_config || {};
  const flag = provider === 'sso' ? 'enable_sso_login' : `enable_${provider}_login`;
  if (options[flag] === false || (options[flag] == null && provider !== 'google')) {
    const name = provider === 'sso' ? 'SSO' : provider[0].toUpperCase() + provider.slice(1);
    throw new Error(`${name} sign-in is not configured.`);
  }
  return storeApi.auth.loginWithProvider(provider, returnTo, { manage });
}

export function finishSignIn(_sessionMarker, returnTo) {
  if (new URLSearchParams(window.location.search).get('popup') === '1' && window.opener) {
    window.opener.postMessage({ authenticated: true }, window.location.origin);
    window.close();
    return;
  }
  window.location.href = returnTo;
}
