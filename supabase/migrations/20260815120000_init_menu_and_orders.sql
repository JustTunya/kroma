-- KROMA Coffee & Bakehouse — core schema
-- menu_categories / menu_items / orders / order_items

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- categories
create table menu_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------- items
create table menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references menu_categories(id) on delete restrict,
  slug          text not null unique,
  name          text not null,
  description   text,
  base_price    numeric(6,2) not null check (base_price >= 0),
  -- null = unlimited (espresso bar drinks); >= 0 = batch limited
  daily_stock   integer check (daily_stock >= 0),
  dietary_tags  text[] not null default '{}',
  allergens     text[] not null default '{}',
  -- [{ "name": "Milk Choice", "required": true, "min": 1, "max": 1,
  --    "options": [{ "name": "Oat Milk", "priceOffset": 0.60 }] }]
  modifiers     jsonb not null default '[]'::jsonb,
  unsplash_query text,
  image_url     text,
  is_active     boolean not null default true,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index menu_items_category_idx on menu_items (category_id, sort_order);
create index menu_items_dietary_idx  on menu_items using gin (dietary_tags);
create index menu_items_allergen_idx on menu_items using gin (allergens);

-- -------------------------------------------------------------------- orders
create type order_status as enum ('pending', 'paid', 'preparing', 'ready', 'collected', 'cancelled');

-- daily-ish human token: #042
create sequence order_number_seq;

create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  integer not null unique default nextval('order_number_seq'),
  status        order_status not null default 'pending',
  customer_name text,
  notes         text,
  subtotal      numeric(8,2) not null default 0 check (subtotal >= 0),
  total         numeric(8,2) not null default 0 check (total >= 0),
  placed_at     timestamptz not null default now(),
  ready_at      timestamptz,
  updated_at    timestamptz not null default now()
);

create index orders_status_idx on orders (status, placed_at);

-- --------------------------------------------------------------- order items
create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  -- snapshot fields: menu item may be renamed/repriced/deleted later
  menu_item_id uuid references menu_items(id) on delete set null,
  item_name    text not null,
  base_price   numeric(6,2) not null,
  quantity     smallint not null default 1 check (quantity > 0),
  -- [{ "group": "Milk Choice", "option": "Oat Milk (Vegan)", "priceOffset": 0.60 }]
  selected_modifiers jsonb not null default '[]'::jsonb,
  line_total   numeric(8,2) not null check (line_total >= 0),
  created_at   timestamptz not null default now()
);

create index order_items_order_idx on order_items (order_id);

-- ------------------------------------------------------------- updated_at
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger menu_items_updated_at before update on menu_items
  for each row execute function set_updated_at();
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------- RLS
alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;

-- menu is public read-only; writes go through service role
create policy "menu categories public read" on menu_categories
  for select using (is_active);
create policy "menu items public read" on menu_items
  for select using (is_active);

-- orders: no anon policies. All order reads/writes must go through the
-- service role (server actions / route handlers), so customers cannot
-- enumerate or mutate other people's orders.
