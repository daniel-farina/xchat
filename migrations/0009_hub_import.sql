-- Metadata for apps imported from Hub / Explore / X posts
alter table showcase_items
  add column if not exists source_hostname text,
  add column if not exists hub_views integer,
  add column if not exists hub_likes integer,
  add column if not exists hub_rating real,
  add column if not exists x_top_likes integer,
  add column if not exists post_likes_total integer,
  add column if not exists post_likes_max integer,
  add column if not exists source_posts jsonb,
  add column if not exists import_sources text;

create unique index if not exists showcase_items_source_hostname_uidx
  on showcase_items (lower(source_hostname))
  where source_hostname is not null;

create index if not exists showcase_items_x_top_likes_idx
  on showcase_items (x_top_likes desc nulls last);

create index if not exists showcase_items_hub_views_idx
  on showcase_items (hub_views desc nulls last);
