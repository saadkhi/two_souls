import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID,
} from 'node:crypto';
import { getDatabase } from '../db.js';

const SESSION_COOKIE = 'two_souls_session';
const TRUST_COOKIE = 'two_souls_trusted_device';
const OAUTH_COOKIE = 'two_souls_oauth_state';
const DAY = 86_400;
const SESSION_DAYS = 14;
const TRUST_DAYS = 30;
const TOKEN_TTL = { verify_email: 15 * 60, password_reset: 60 * 60, mfa: 10 * 60, oauth: 10 * 60 };
const schemaStatements = [
  `create table if not exists auth_users (id text primary key,email text not null,password_hash text,full_name text not null default '',role text not null default 'user' check (role in ('admin','user')),email_verified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now())`,
  `create unique index if not exists auth_users_email_unique on auth_users (lower(email))`,
  `create table if not exists auth_sessions (token_hash text primary key,user_id text not null references auth_users(id) on delete cascade,expires_at timestamptz not null,created_at timestamptz not null default now(),last_seen_at timestamptz not null default now())`,
  `create index if not exists auth_sessions_user_idx on auth_sessions(user_id,expires_at desc)`,
  `create table if not exists auth_tokens (token_hash text primary key,user_id text not null references auth_users(id) on delete cascade,kind text not null,payload jsonb not null default '{}'::jsonb,expires_at timestamptz not null,consumed_at timestamptz,created_at timestamptz not null default now())`,
  `create index if not exists auth_tokens_user_kind_idx on auth_tokens(user_id,kind,created_at desc)`,
  `create table if not exists auth_factors (id text primary key,user_id text not null references auth_users(id) on delete cascade,kind text not null check (kind in ('totp','sms')),secret_encrypted text,phone_encrypted text,verified_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(user_id,kind))`,
  `create table if not exists auth_trusted_devices (token_hash text primary key,user_id text not null references auth_users(id) on delete cascade,expires_at timestamptz not null,created_at timestamptz not null default now())`,
  `create table if not exists auth_oauth_accounts (provider text not null,provider_subject text not null,user_id text not null references auth_users(id) on delete cascade,email text not null,created_at timestamptz not null default now(),primary key(provider,provider_subject))`,
  `create table if not exists auth_rate_limits (key_hash text primary key,bucket_started_at timestamptz not null,attempts integer not null default 0)`,
];

let schemaReady;
let googleKeys;

function database() {
  try {
    return getDatabase();
  } catch (error) {
    throw new AuthError(error?.status || 503, error?.message || 'Database is not configured. Add DATABASE_URL in Vercel.');
  }
}

export async function ensureAuthSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = database();
      for (const statement of schemaStatements) await sql.unsafe(statement);
      await bootstrapAdmins(sql);
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export class AuthError extends Error {
  constructor(status, message, retryAfter = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const sha256 = value => createHash('sha256').update(String(value)).digest('hex');
const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
const code = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const publicUser = user => ({ id: user.id, email: user.email, full_name: user.full_name || '', role: user.role });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...headers },
});

function cookieHeader(name, value, { maxAge = null, request, httpOnly = true } = {}) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure ? '; Secure' : ''}${maxAge === null ? '' : `; Max-Age=${maxAge}`}`;
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.get('cookie') || '').split(';').map(part => {
    const at = part.indexOf('=');
    if (at < 0) return ['', ''];
    return [part.slice(0, at).trim(), decodeURIComponent(part.slice(at + 1).trim())];
  }).filter(([key]) => key));
}

function bearer(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function safeReturnTo(value, request) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  try {
    const url = new URL(value || '/', origin);
    if (url.origin !== origin || !url.pathname.startsWith('/') || url.pathname.startsWith('//') || url.pathname.includes('\\')) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}

function appOrigin(request) {
  const value = process.env.APP_URL || new URL(request.url).origin;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new AuthError(503, 'APP_URL is invalid.');
  return url.origin;
}

function requireSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== appOrigin(request)) {
    throw new AuthError(403, 'Request origin is not allowed.');
  }
}

async function body(request) {
  if (!request.body) return {};
  return request.json().catch(() => { throw new AuthError(400, 'Request body must be valid JSON.'); });
}

async function bootstrapAdmins(sql) {
  const emails = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '').split(',').map(normalizeEmail).filter(Boolean);
  for (const email of emails) {
    const existing = await sql`select id from auth_users where lower(email)=${email} limit 1`;
    if (existing.length) {
      await sql`update auth_users set role='admin',updated_at=now() where id=${existing[0].id}`;
    } else if (process.env.ADMIN_PASSWORD) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await sql`insert into auth_users (id,email,password_hash,full_name,role,email_verified_at) values (${randomUUID()},${email},${passwordHash},${process.env.ADMIN_NAME || 'Store owner'},'admin',now())`;
    }
  }
}

async function rateLimit(request, action, limit = 10, windowSeconds = 900) {
  const sql = database();
  const ip = String(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const key = sha256(`${action}:${ip}`);
  const rows = await sql`
    insert into auth_rate_limits (key_hash,bucket_started_at,attempts) values (${key},now(),1)
    on conflict (key_hash) do update set
      bucket_started_at=case when auth_rate_limits.bucket_started_at < now()-(${windowSeconds}::text || ' seconds')::interval then now() else auth_rate_limits.bucket_started_at end,
      attempts=case when auth_rate_limits.bucket_started_at < now()-(${windowSeconds}::text || ' seconds')::interval then 1 else auth_rate_limits.attempts+1 end
    returning attempts,bucket_started_at`;
  if (Number(rows[0].attempts) > limit) throw new AuthError(429, 'Too many attempts. Try again later.', windowSeconds);
}

async function createStoredToken(userId, kind, payload, ttlSeconds = TOKEN_TTL[kind] || 600) {
  const sql = database();
  const value = token();
  await sql`insert into auth_tokens (token_hash,user_id,kind,payload,expires_at) values (${sha256(value)},${userId},${kind},${sql.json(payload || {})},now()+(${ttlSeconds}::text || ' seconds')::interval)`;
  return value;
}

async function storedToken(value, kind, { consume = false } = {}) {
  if (!value) throw new AuthError(401, 'This sign-in request has expired. Sign in again.');
  const sql = database();
  const rows = await sql`select * from auth_tokens where token_hash=${sha256(value)} and kind=${kind} and consumed_at is null and expires_at>now() limit 1`;
  if (!rows.length) throw new AuthError(401, 'This sign-in request has expired. Sign in again.');
  if (consume) await sql`update auth_tokens set consumed_at=now() where token_hash=${sha256(value)}`;
  return rows[0];
}

async function replaceTokenPayload(value, kind, payload) {
  await database()`update auth_tokens set payload=${database().json(payload)},expires_at=greatest(expires_at,now()+interval '5 minutes') where token_hash=${sha256(value)} and kind=${kind}`;
}

async function findUser(email) {
  const rows = await database()`select * from auth_users where lower(email)=${normalizeEmail(email)} limit 1`;
  return rows[0] || null;
}

async function factors(userId) {
  return database()`select * from auth_factors where user_id=${userId} order by kind`;
}

async function createSession(userId, request, { remember = false } = {}) {
  const sql = database();
  const value = token();
  const maxAge = (remember ? 30 : SESSION_DAYS) * DAY;
  await sql`insert into auth_sessions (token_hash,user_id,expires_at) values (${sha256(value)},${userId},now()+(${maxAge}::text || ' seconds')::interval)`;
  return { value, header: cookieHeader(SESSION_COOKIE, value, { maxAge, request }) };
}

async function createTrustedDevice(userId, request) {
  const value = token();
  await database()`insert into auth_trusted_devices (token_hash,user_id,expires_at) values (${sha256(value)},${userId},now()+interval '30 days')`;
  return cookieHeader(TRUST_COOKIE, value, { maxAge: TRUST_DAYS * DAY, request });
}

export async function getSessionUser(request) {
  await ensureAuthSchema();
  const value = cookies(request)[SESSION_COOKIE];
  if (!value) return null;
  const rows = await database()`select u.* from auth_sessions s join auth_users u on u.id=s.user_id where s.token_hash=${sha256(value)} and s.expires_at>now() limit 1`;
  if (!rows.length) return null;
  database()`update auth_sessions set last_seen_at=now() where token_hash=${sha256(value)}`.catch(() => {});
  return publicUser(rows[0]);
}

function encryptionKey() {
  const value = process.env.DATA_ENCRYPTION_KEY || '';
  if (value.length < 32) throw new AuthError(503, 'DATA_ENCRYPTION_KEY must contain at least 32 characters.');
  return createHash('sha256').update(value).digest();
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}

function decrypt(value) {
  const [iv, tag, ciphertext] = String(value).split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function deliverEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      console.info(`[local mail] To: ${to}\n${subject}\n${text}`);
      return;
    }
    throw new AuthError(503, 'Email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!response.ok) throw new AuthError(502, 'Email delivery failed. Please try again.');
}

async function deliverSms(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !auth || !from) {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      console.info(`[local sms] To: ${phone}\n${message}`);
      return;
    }
    throw new AuthError(503, 'SMS delivery is not configured. Add the Twilio variables in Vercel.');
  }
  const form = new URLSearchParams({ To: phone, From: from, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) throw new AuthError(502, 'Text-message delivery failed. Please try again.');
}

async function issueEmailOtp(user) {
  const sql = database();
  const value = code();
  await sql`update auth_tokens set consumed_at=now() where user_id=${user.id} and kind='verify_email' and consumed_at is null`;
  await createStoredToken(user.id, 'verify_email', { code_hash: sha256(value) });
  await deliverEmail({
    to: user.email,
    subject: 'Verify your Two Souls account',
    text: `Your verification code is ${value}. It expires in 15 minutes.`,
    html: `<p>Your Two Souls verification code is:</p><p style="font-size:28px;letter-spacing:6px"><strong>${value}</strong></p><p>It expires in 15 minutes.</p>`,
  });
}

async function hasTrustedDevice(userId, request) {
  const value = cookies(request)[TRUST_COOKIE];
  if (!value) return false;
  const rows = await database()`select 1 from auth_trusted_devices where token_hash=${sha256(value)} and user_id=${userId} and expires_at>now() limit 1`;
  return Boolean(rows.length);
}

async function newMfaChallenge(user, request, { manage = false, oauth = false } = {}) {
  const enrolled = await factors(user.id);
  const methods = enrolled.map(factor => factor.kind);
  const required = process.env.MFA_REQUIRED === 'true';
  if (!manage && !required && !methods.length) {
    const session = await createSession(user.id, request);
    return { result: { access_token: 'cookie-session', user: publicUser(user) }, cookies: [session.header] };
  }
  if (!manage && methods.length && await hasTrustedDevice(user.id, request)) {
    const session = await createSession(user.id, request);
    return { result: { access_token: 'cookie-session', user: publicUser(user) }, cookies: [session.header] };
  }
  const challenge = await createStoredToken(user.id, 'mfa', { purpose: manage ? 'manage' : 'login', oauth, methods });
  return {
    result: {
      mfa_required: true,
      mfa_session_token: challenge,
      next_step: methods.length ? 'verify' : 'enroll',
      mfa_methods: methods,
      phone_hint: phoneHint(enrolled.find(factor => factor.kind === 'sms')?.phone_encrypted),
    },
    cookies: [],
  };
}

function phoneHint(encrypted) {
  if (!encrypted) return '';
  const phone = decrypt(encrypted);
  return phone.length > 4 ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : 'your phone';
}

function appendCookies(response, values) {
  for (const value of values.filter(Boolean)) response.headers.append('Set-Cookie', value);
  return response;
}

async function completeMfa(challenge, request, remember) {
  const sql = database();
  const users = await sql`select * from auth_users where id=${challenge.user_id} limit 1`;
  if (!users.length) throw new AuthError(401, 'This account no longer exists.');
  const payload = challenge.payload || {};
  if (payload.purpose === 'manage') {
    return { result: { mfa_management_token: bearer(request) }, cookies: [] };
  }
  await sql`update auth_tokens set consumed_at=now() where token_hash=${challenge.token_hash}`;
  const session = await createSession(challenge.user_id, request, { remember });
  const trusted = remember ? await createTrustedDevice(challenge.user_id, request) : null;
  return { result: { access_token: 'cookie-session', user: publicUser(users[0]) }, cookies: [session.header, trusted] };
}

function makeTotp(secret, email) {
  return new OTPAuth.TOTP({ issuer: process.env.APP_NAME || 'Two Souls', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret });
}

async function verifyFactor(factor, value, userEmail) {
  if (factor.kind === 'totp') {
    const secret = decrypt(factor.secret_encrypted);
    return makeTotp(OTPAuth.Secret.fromBase32(secret), userEmail).validate({ token: String(value), window: 1 }) !== null;
  }
  return false;
}

async function mfaChallenge(request, tokenValue = bearer(request)) {
  return storedToken(tokenValue, 'mfa');
}

async function updateChallenge(tokenValue, row, payload) {
  await database()`update auth_tokens set payload=${database().json(payload)} where token_hash=${row.token_hash}`;
}

async function authSettings() {
  return {
    name: process.env.APP_NAME || 'Two Souls',
    auth_config: {
      mfa_policy: process.env.MFA_REQUIRED === 'true' ? 'required' : 'optional',
      enable_username_password: true,
      enable_google_login: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      enable_microsoft_login: false,
      enable_facebook_login: false,
      enable_apple_login: false,
      enable_sso_login: false,
      use_workspace_sso: false,
    },
  };
}

async function handleRegister(request) {
  await rateLimit(request, 'register', 8, 900);
  const input = await body(request);
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthError(400, 'Enter a valid email address.');
  if (String(input.password || '').length < 8) throw new AuthError(400, 'Password must contain at least 8 characters.');
  const sql = database();
  let user = await findUser(email);
  if (user?.email_verified_at) throw new AuthError(409, 'An account already exists with this email.');
  const passwordHash = await bcrypt.hash(String(input.password), 12);
  if (user) {
    const rows = await sql`update auth_users set password_hash=${passwordHash},updated_at=now() where id=${user.id} returning *`;
    user = rows[0];
  } else {
    const rows = await sql`insert into auth_users (id,email,password_hash,full_name) values (${randomUUID()},${email},${passwordHash},${String(input.full_name || input.fullName || '')}) returning *`;
    user = rows[0];
  }
  await issueEmailOtp(user);
  return json({ verification_required: true, email });
}

async function handleVerifyEmail(request) {
  await rateLimit(request, 'verify-email', 15, 900);
  const input = await body(request);
  const user = await findUser(input.email);
  if (!user) throw new AuthError(400, 'Invalid or expired verification code.');
  const rows = await database()`select * from auth_tokens where user_id=${user.id} and kind='verify_email' and consumed_at is null and expires_at>now() order by created_at desc limit 1`;
  if (!rows.length || rows[0].payload?.code_hash !== sha256(input.otpCode || input.code || '')) throw new AuthError(400, 'Invalid or expired verification code.');
  await database().begin(async sql => {
    await sql`update auth_users set email_verified_at=coalesce(email_verified_at,now()),updated_at=now() where id=${user.id}`;
    await sql`update auth_tokens set consumed_at=now() where token_hash=${rows[0].token_hash}`;
  });
  const refreshed = await findUser(user.email);
  const next = await newMfaChallenge(refreshed, request);
  return appendCookies(json(next.result), next.cookies);
}

async function handleLogin(request) {
  await rateLimit(request, 'login', 12, 900);
  const input = await body(request);
  const user = await findUser(input.email);
  if (!user?.password_hash || !await bcrypt.compare(String(input.password || ''), user.password_hash)) throw new AuthError(401, 'Invalid email or password.');
  if (!user.email_verified_at) throw new AuthError(403, 'Verify your email before signing in.');
  const manage = input.manage === true || request.headers.get('x-app-mfa-action') === 'manage';
  const next = await newMfaChallenge(user, request, { manage });
  return appendCookies(json(next.result), next.cookies);
}

async function handleResetRequest(request) {
  await rateLimit(request, 'password-reset', 6, 3600);
  const input = await body(request);
  const user = await findUser(input.email);
  if (user?.email_verified_at) {
    const value = await createStoredToken(user.id, 'password_reset', {}, TOKEN_TTL.password_reset);
    const url = `${appOrigin(request)}/reset-password?token=${encodeURIComponent(value)}`;
    // The response stays intentionally identical for known and unknown
    // addresses. Delivery failures are logged without revealing membership.
    await deliverEmail({ to: user.email, subject: 'Reset your Two Souls password', text: `Reset your password: ${url}`, html: `<p><a href="${url}">Reset your password</a>. This link expires in one hour.</p>` })
      .catch(error => console.error('Password-reset email delivery failed:', error));
  }
  return json({ ok: true });
}

async function handleReset(request) {
  const input = await body(request);
  if (String(input.newPassword || input.password || '').length < 8) throw new AuthError(400, 'Password must contain at least 8 characters.');
  const reset = await storedToken(input.resetToken || input.token, 'password_reset', { consume: true });
  const passwordHash = await bcrypt.hash(String(input.newPassword || input.password), 12);
  await database().begin(async sql => {
    await sql`update auth_users set password_hash=${passwordHash},updated_at=now() where id=${reset.user_id}`;
    await sql`delete from auth_sessions where user_id=${reset.user_id}`;
  });
  return json({ ok: true });
}

async function handleLogout(request) {
  const value = cookies(request)[SESSION_COOKIE];
  if (value) await database()`delete from auth_sessions where token_hash=${sha256(value)}`;
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(SESSION_COOKIE, '', { maxAge: 0, request }) });
}

async function handleOAuthStart(request, provider) {
  if (provider !== 'google' || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new AuthError(404, 'This sign-in provider is not configured.');
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'), request);
  const manage = url.searchParams.get('manage') === '1';
  const state = token();
  const verifier = token();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const placeholderUser = await oauthStateUser();
  await database()`insert into auth_tokens (token_hash,user_id,kind,payload,expires_at) values (${sha256(state)},${placeholderUser},'oauth',${database().json({ provider, returnTo, manage, verifier })},now()+interval '10 minutes')`;
  const redirect = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  redirect.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${appOrigin(request)}/api/auth/oauth/google/callback`, response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  return new Response(null, { status: 302, headers: { Location: redirect.href, 'Set-Cookie': cookieHeader(OAUTH_COOKIE, state, { maxAge: 600, request }) } });
}

async function oauthStateUser() {
  const sql = database();
  const email = 'oauth-state@internal.invalid';
  const rows = await sql`select id from auth_users where email=${email} limit 1`;
  if (rows.length) return rows[0].id;
  const id = randomUUID();
  await sql`insert into auth_users (id,email,full_name,role,email_verified_at) values (${id},${email},'OAuth state','user',now()) on conflict do nothing`;
  return (await sql`select id from auth_users where email=${email} limit 1`)[0].id;
}

async function handleOAuthCallback(request, provider) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  if (!state || cookies(request)[OAUTH_COOKIE] !== state) throw new AuthError(400, 'The sign-in request is invalid or expired.');
  const stateRow = await storedToken(state, 'oauth', { consume: true });
  const payload = stateRow.payload || {};
  if (provider !== 'google' || payload.provider !== provider) throw new AuthError(400, 'The sign-in provider does not match this request.');
  const codeValue = url.searchParams.get('code');
  if (!codeValue) throw new AuthError(400, 'Google did not return an authorization code.');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: codeValue, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: `${appOrigin(request)}/api/auth/oauth/google/callback`, grant_type: 'authorization_code', code_verifier: payload.verifier }) });
  if (!tokenResponse.ok) throw new AuthError(502, 'Google sign-in could not be completed.');
  const tokens = await tokenResponse.json();
  googleKeys ||= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  const { payload: profile } = await jwtVerify(tokens.id_token, googleKeys, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: process.env.GOOGLE_CLIENT_ID });
  if (!profile.email || profile.email_verified !== true) throw new AuthError(403, 'Google did not provide a verified email address.');
  const sql = database();
  let user = await findUser(profile.email);
  if (!user) {
    const rows = await sql`insert into auth_users (id,email,full_name,email_verified_at) values (${randomUUID()},${normalizeEmail(profile.email)},${String(profile.name || '')},now()) returning *`;
    user = rows[0];
  }
  await sql`insert into auth_oauth_accounts (provider,provider_subject,user_id,email) values ('google',${String(profile.sub)},${user.id},${user.email}) on conflict (provider,provider_subject) do update set user_id=excluded.user_id,email=excluded.email`;
  const next = await newMfaChallenge(user, request, { manage: payload.manage === true, oauth: true });
  const clearOauth = cookieHeader(OAUTH_COOKIE, '', { maxAge: 0, request });
  if (next.result.mfa_required) {
    const location = `/mfa?mfa_code=${encodeURIComponent(next.result.mfa_session_token)}&returnTo=${encodeURIComponent(payload.returnTo || '/')}`;
    return new Response(null, { status: 302, headers: { Location: location, 'Set-Cookie': clearOauth } });
  }
  const response = new Response(null, { status: 302, headers: { Location: payload.returnTo || '/' } });
  appendCookies(response, [...next.cookies, clearOauth]);
  return response;
}

async function handleMfa(request, operation) {
  const credential = bearer(request);
  if (operation === 'exchange') {
    const input = await body(request);
    const row = await storedToken(input.code, 'mfa');
    const enrolled = await factors(row.user_id);
    return json({ mfa_required: true, mfa_session_token: input.code, next_step: enrolled.length ? 'verify' : 'enroll', mfa_methods: enrolled.map(item => item.kind), phone_hint: phoneHint(enrolled.find(item => item.kind === 'sms')?.phone_encrypted) });
  }
  const challenge = await mfaChallenge(request);
  const payload = challenge.payload || {};

  if (operation === 'handoff') {
    // Exchange the bearer credential for a separate, short-lived URL handoff
    // code. The original credential is immediately revoked.
    const handoff = await createStoredToken(challenge.user_id, 'mfa', payload, 120);
    await database()`update auth_tokens set consumed_at=now() where token_hash=${challenge.token_hash}`;
    return json({ code: handoff });
  }

  const users = await database()`select * from auth_users where id=${challenge.user_id} limit 1`;
  if (!users.length) throw new AuthError(401, 'This account no longer exists.');
  const user = users[0];
  const input = request.method === 'GET' ? {} : await body(request);

  if (operation === 'status') {
    if (payload.purpose !== 'manage') throw new AuthError(403, 'Sign in again to manage two-factor authentication.');
    const enrolled = await factors(user.id);
    return json({ methods: enrolled.map(item => item.kind), phone_hint: phoneHint(enrolled.find(item => item.kind === 'sms')?.phone_encrypted) });
  }

  if (operation === 'totp/setup') {
    const secret = new OTPAuth.Secret({ size: 20 });
    payload.pending_totp = encrypt(secret.base32);
    await updateChallenge(credential, challenge, payload);
    const uri = makeTotp(secret, user.email).toString();
    return json({ secret_formatted: secret.base32.match(/.{1,4}/g).join(' '), qr_code: await QRCode.toDataURL(uri, { margin: 1, width: 256 }) });
  }

  if (operation === 'totp/verify') {
    const encrypted = payload.pending_totp;
    const enrolled = (await factors(user.id)).find(item => item.kind === 'totp');
    const secretValue = encrypted ? decrypt(encrypted) : enrolled ? decrypt(enrolled.secret_encrypted) : '';
    if (!secretValue || makeTotp(OTPAuth.Secret.fromBase32(secretValue), user.email).validate({ token: String(input.code || ''), window: 1 }) === null) throw new AuthError(400, 'The authenticator code is not valid.');
    if (encrypted) await database()`insert into auth_factors (id,user_id,kind,secret_encrypted,verified_at) values (${randomUUID()},${user.id},'totp',${encrypt(secretValue)},now()) on conflict (user_id,kind) do update set secret_encrypted=excluded.secret_encrypted,verified_at=now()`;
    delete payload.pending_totp;
    await updateChallenge(credential, challenge, payload);
    const result = await completeMfa(challenge, request, input.remember_device === true);
    return appendCookies(json(result.result), result.cookies);
  }

  if (operation === 'sms/send-code' || operation === 'resend') {
    const enrolled = (await factors(user.id)).find(item => item.kind === 'sms');
    let phone;
    if (input.phone_number) {
      phone = String(input.phone_number).replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AuthError(400, 'Enter a valid phone number including country code.');
      payload.pending_phone = encrypt(phone);
    } else if (enrolled) phone = decrypt(enrolled.phone_encrypted);
    if (!phone) throw new AuthError(409, 'No verified phone number is available.');
    const smsCode = code();
    payload.sms_code_hash = sha256(smsCode);
    payload.sms_sent_at = Date.now();
    await updateChallenge(credential, challenge, payload);
    await deliverSms(phone, `Your Two Souls verification code is ${smsCode}. It expires in 10 minutes.`);
    return json({ sent: true, phone_hint: phoneHint(encrypt(phone)) });
  }

  if (operation === 'sms/verify') {
    if (!payload.sms_code_hash || Date.now() - Number(payload.sms_sent_at || 0) > 10 * 60 * 1000 || payload.sms_code_hash !== sha256(input.code || '')) throw new AuthError(400, 'The text-message code is not valid or has expired.');
    if (payload.pending_phone) await database()`insert into auth_factors (id,user_id,kind,phone_encrypted,verified_at) values (${randomUUID()},${user.id},'sms',${payload.pending_phone},now()) on conflict (user_id,kind) do update set phone_encrypted=excluded.phone_encrypted,verified_at=now()`;
    delete payload.pending_phone; delete payload.sms_code_hash; delete payload.sms_sent_at;
    await updateChallenge(credential, challenge, payload);
    const result = await completeMfa(challenge, request, input.remember_device === true);
    return appendCookies(json(result.result), result.cookies);
  }

  if (operation === 'verify') {
    const factor = (await factors(user.id)).find(item => item.kind === input.method);
    if (!factor) throw new AuthError(409, 'That verification method is not enabled.');
    let valid = false;
    if (factor.kind === 'totp') valid = await verifyFactor(factor, input.code, user.email);
    if (factor.kind === 'sms') valid = payload.sms_code_hash === sha256(input.code || '') && Date.now() - Number(payload.sms_sent_at || 0) <= 10 * 60 * 1000;
    if (!valid) throw new AuthError(400, 'The verification code is not valid.');
    const result = await completeMfa(challenge, request, input.remember_device === true);
    return appendCookies(json(result.result), result.cookies);
  }

  if (operation === 'disable' || operation === 'trusted-devices/clear') {
    if (payload.purpose !== 'manage') throw new AuthError(403, 'Sign in again to manage two-factor authentication.');
    const enrolled = await factors(user.id);
    const proof = enrolled.find(item => item.kind === (input.verification_method || input.method));
    let valid = proof ? await verifyFactor(proof, input.code, user.email) : false;
    if (proof?.kind === 'sms') valid = payload.sms_code_hash === sha256(input.code || '') && Date.now() - Number(payload.sms_sent_at || 0) <= 10 * 60 * 1000;
    if (!valid) throw new AuthError(400, 'The verification code is not valid.');
    if (operation === 'trusted-devices/clear') {
      await database()`delete from auth_trusted_devices where user_id=${user.id}`;
      return json({ cleared: true });
    }
    if (process.env.MFA_REQUIRED === 'true' && enrolled.length <= 1) throw new AuthError(409, 'At least one verification method must remain enabled.');
    await database()`delete from auth_factors where user_id=${user.id} and kind=${String(input.method)}`;
    return json({ disabled: true });
  }

  throw new AuthError(404, 'Authentication endpoint not found.');
}

export async function handleAuth(request, pathSegments = []) {
  try {
    const path = pathSegments.filter(Boolean).join('/');
    if (path === 'settings' || path === 'providers' || path === 'public-settings') return json(await authSettings());
    await ensureAuthSchema();
    requireSameOrigin(request);
    if (path === 'register' && request.method === 'POST') return await handleRegister(request);
    if (['verify', 'verify-otp', 'verify-email'].includes(path) && request.method === 'POST') return await handleVerifyEmail(request);
    if (['resend-otp', 'resend-verification'].includes(path) && request.method === 'POST') {
      await rateLimit(request, 'resend-email', 6, 3600);
      const input = await body(request); const user = await findUser(input.email);
      if (user && !user.email_verified_at) {
        await issueEmailOtp(user).catch(error => console.error('Verification email delivery failed:', error));
      }
      return json({ ok: true });
    }
    if (path === 'login' && request.method === 'POST') return await handleLogin(request);
    if ((path === 'session' || path === 'me') && request.method === 'GET') {
      const user = await getSessionUser(request);
      if (!user) throw new AuthError(401, 'Authentication required.');
      return json(user);
    }
    if (path === 'logout' && request.method === 'POST') return await handleLogout(request);
    if (['reset-request', 'password-reset/request'].includes(path) && request.method === 'POST') return await handleResetRequest(request);
    if (['reset', 'password-reset/confirm'].includes(path) && request.method === 'POST') return await handleReset(request);
    if (path.startsWith('oauth/') && path.endsWith('/start') && request.method === 'GET') return await handleOAuthStart(request, path.split('/')[1]);
    if (path.startsWith('oauth/') && path.endsWith('/callback') && request.method === 'GET') return await handleOAuthCallback(request, path.split('/')[1]);
    if (path.startsWith('mfa/')) return await handleMfa(request, path.slice(4));
    throw new AuthError(404, 'Authentication endpoint not found.');
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error('Authentication request failed:', error);
    const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {};
    return json({ error: { message: status === 500 ? 'Authentication service is temporarily unavailable.' : error.message }, detail: status === 500 ? undefined : error.message }, status, headers);
  }
}
