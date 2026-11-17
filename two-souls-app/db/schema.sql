create table if not exists records (
  id text primary key, entity text not null, data jsonb not null default '{}'::jsonb,
  created_by_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists records_entity_created_idx on records(entity, created_at desc);
create index if not exists records_entity_owner_idx on records(entity, created_by_id);
create index if not exists records_data_gin_idx on records using gin(data jsonb_path_ops);
create unique index if not exists product_slug_unique on records(lower(data->>'slug')) where entity = 'Product';
create unique index if not exists collection_slug_unique on records(lower(data->>'slug')) where entity = 'Collection';
create unique index if not exists coupon_code_unique on records(upper(data->>'code')) where entity = 'Coupon';
create unique index if not exists order_number_unique on records(data->>'orderNumber') where entity = 'Order';
create unique index if not exists order_idempotency_unique on records(data->>'idempotencyKey')
  where entity = 'Order' and coalesce(data->>'idempotencyKey', '') <> '';
create unique index if not exists settings_key_unique on records(data->>'key') where entity = 'BusinessSettings';
create unique index if not exists content_key_unique on records(data->>'key') where entity = 'SiteContent';
create unique index if not exists subscriber_email_unique on records(lower(data->>'email')) where entity = 'NewsletterSubscriber';
create unique index if not exists profile_email_unique on records(lower(data->>'userEmail'))
  where entity = 'CustomerProfile' and coalesce(data->>'userEmail', '') <> '';
create table if not exists files (
  id text primary key, owner_id text,
  blob_url text not null, blob_path text not null unique,
  visibility text not null check (visibility in ('public', 'private')),
  mime_type text not null, size_bytes bigint not null, original_name text,
  created_at timestamptz not null default now()
);
create table if not exists rate_limits (
  bucket text not null, subject_hash text not null, window_start timestamptz not null,
  hits integer not null default 1, primary key(bucket, subject_hash, window_start)
);
create index if not exists rate_limits_window_idx on rate_limits(window_start);
