-- Owner-curated "this week's drop" for the account Overview. No admin UI
-- exists, so this is flipped straight in the Supabase table editor — the same
-- way daily_stock already is.
alter table menu_items add column is_featured boolean not null default false;
