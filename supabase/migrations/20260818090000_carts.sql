-- One cart row per signed-in user. Items are a JSONB snapshot array
-- (menu_item_id, name, base_price, quantity, selected_modifiers, image_url)
-- mirroring order_items, so it maps straight onto order_items at checkout.
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger carts_updated_at before update on carts
  for each row execute function set_updated_at();

alter table carts enable row level security;

create policy "carts read own" on carts
  for select using (auth.uid() = user_id);
create policy "carts insert own" on carts
  for insert with check (auth.uid() = user_id);
create policy "carts update own" on carts
  for update using (auth.uid() = user_id);
