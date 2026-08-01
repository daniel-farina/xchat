-- Showcase app category for filtering / browsing.

alter table showcase_items
  add column if not exists category text not null default 'other';
