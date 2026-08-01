-- Friendly unique URL slugs for showcase apps (e.g. /showcase/neon-todo).

alter table showcase_items
  add column if not exists slug text;

-- Backfill empty slugs from app_name + short id so uniqueness holds before index.
update showcase_items
set slug = lower(
  regexp_replace(
    regexp_replace(coalesce(nullif(trim(app_name), ''), 'app'), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)',
    '',
    'g'
  )
) || '-' || substr(replace(id::text, '-', ''), 1, 6)
where slug is null or trim(slug) = '';

-- Ensure not null going forward
alter table showcase_items
  alter column slug set not null;

create unique index if not exists showcase_items_slug_uidx
  on showcase_items (lower(slug));
