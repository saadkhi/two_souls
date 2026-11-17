-- Authentication tables used by the Vercel Functions. The storefront's domain
-- records live separately so sessions can be revoked without touching orders.
create table if not exists auth_users (
  id text primary key,
  email text not null,
  password_hash text,
  full_name text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists auth_users_email_unique on auth_users (lower(email));

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists auth_sessions_user_idx on auth_sessions(user_id, expires_at desc);

create table if not exists auth_tokens (
  token_hash text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_user_kind_idx on auth_tokens(user_id, kind, created_at desc);

create table if not exists auth_factors (
  id text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  kind text not null check (kind in ('totp', 'sms')),
  secret_encrypted text,
  phone_encrypted text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, kind)
);

create table if not exists auth_trusted_devices (
  token_hash text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_oauth_accounts (
  provider text not null,
  provider_subject text not null,
  user_id text not null references auth_users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key(provider, provider_subject)
);

create table if not exists auth_rate_limits (
  key_hash text primary key,
  bucket_started_at timestamptz not null,
  attempts integer not null default 0
);
