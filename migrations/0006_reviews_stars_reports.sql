-- Stars, written reviews, and malicious-content reports for showcase items.

create table if not exists showcase_ratings (
  item_id text not null references showcase_items (id) on delete cascade,
  user_id text not null,
  stars integer not null check (stars >= 1 and stars <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists showcase_ratings_item_idx on showcase_ratings (item_id);

create table if not exists showcase_reviews (
  id text primary key,
  item_id text not null references showcase_items (id) on delete cascade,
  user_id text not null,
  author_name text not null,
  author_handle text not null default '',
  body text not null,
  stars integer check (stars is null or (stars >= 1 and stars <= 5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists showcase_reviews_item_idx
  on showcase_reviews (item_id, created_at desc);

create table if not exists showcase_reports (
  id text primary key,
  item_id text not null references showcase_items (id) on delete cascade,
  user_id text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists showcase_reports_item_idx on showcase_reports (item_id);
create index if not exists showcase_reports_created_idx on showcase_reports (created_at desc);
