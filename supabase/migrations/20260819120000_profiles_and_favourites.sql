-- Somewhere for a customer's own details to live. Until now the only record of
-- a person was auth.users plus whatever name they typed at the bar each time.

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  phone            text,
  dietary_tags     text[] not null default '{}',
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Saved items, for the Overview row. Deliberately a join table and nothing
-- more: no notes, no ordering, no folders.
create table favourites (
  user_id      uuid not null references auth.users(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);

alter table profiles   enable row level security;
alter table favourites enable row level security;

-- No signup trigger creating a profile row: the app reads with maybeSingle()
-- and treats null as empty, so the first save upserts. One less thing to keep
-- in sync with auth.
create policy "profiles read own"   on profiles for select using (auth.uid() = id);
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on profiles for update using (auth.uid() = id);

create policy "favourites read own"   on favourites for select using (auth.uid() = user_id);
create policy "favourites insert own" on favourites for insert with check (auth.uid() = user_id);
create policy "favourites delete own" on favourites for delete using (auth.uid() = user_id);
