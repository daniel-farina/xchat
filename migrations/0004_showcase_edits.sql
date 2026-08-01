-- Track owner/admin edits that need re-review.

alter table showcase_items
  add column if not exists change_summary text not null default '';

alter table showcase_items
  add column if not exists last_edited_by text;

alter table showcase_items
  add column if not exists edit_count integer not null default 0;
