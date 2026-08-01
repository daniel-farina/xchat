-- Showcase submissions + lightweight profiles for X handles / admin checks.

create table if not exists profiles (
  user_id text primary key,
  x_handle text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_x_handle_idx on profiles (lower(x_handle));

create table if not exists showcase_items (
  id text primary key,
  user_id text not null,
  author_name text not null,
  author_handle text not null,
  description text not null,
  tools text not null,
  prompt text not null,
  creation_url text not null,
  image_data text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

create index if not exists showcase_items_status_idx on showcase_items (status);
create index if not exists showcase_items_user_id_idx on showcase_items (user_id);
create index if not exists showcase_items_created_at_idx on showcase_items (created_at desc);
