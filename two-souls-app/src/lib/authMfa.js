import { storeApi } from '@/api/storeClient';

async function post(path, body, token) {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.error || result.detail || 'Unable to sign in');
  return result;
}

export async function loginWithMfa(email, password) {
  const result = await post('login', { email, password });
  if (result.access_token) storeApi.auth.setToken(result.access_token);
  return result;
}

export async function continueMfa(result, returnTo) {
  const { code } = await post('mfa/handoff', {}, result.mfa_session_token);
  const url = new URL('/mfa', window.location.origin);
  url.search = new URLSearchParams({ mfa_code: code, returnTo });
  window.location.assign(url.href);
}

export async function loginWithSocial(provider, returnTo) {
  const response = await fetch('/api/auth/providers', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load sign-in options');
  return storeApi.auth.loginWithProvider(provider, returnTo);
}

export function loginWithGoogle(returnTo) {
  return loginWithSocial('google', returnTo);
}
