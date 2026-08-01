-- Title of the creation (app / project name), separate from author display name.

alter table showcase_items
  add column if not exists app_name text not null default '';
