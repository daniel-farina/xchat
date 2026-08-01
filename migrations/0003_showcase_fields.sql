-- Extra submission metadata: model + how the prompt was used.

alter table showcase_items
  add column if not exists model text not null default '';

alter table showcase_items
  add column if not exists prompt_style text not null default 'one_shot';
