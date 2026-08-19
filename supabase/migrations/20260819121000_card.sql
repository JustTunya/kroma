-- The card. Twelve cups, two of them already on it the day you sign up.
--
-- The balance is derived, never stored: orders and order_items already ARE the
-- ledger, and a punch count is a view of purchase history. That is what makes a
-- refund self-healing — cancel the order and its punches leave the sum, with no
-- compensating write anywhere.

-- Which categories earn a punch. Beans and pastry do not.
alter table menu_categories add column earns_punch boolean not null default false;
update menu_categories set earns_punch = true
 where slug in ('espresso-bar', 'filter-cold', 'tea-alternatives');

-- Snapshot, for the same reason item_name and base_price are snapshotted on
-- this table: re-categorising the menu must not rewrite an existing card.
alter table order_items add column earns_punch boolean not null default false;

create table card_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_id      uuid not null unique references orders(id) on delete cascade,
  punches_spent smallint not null default 12,
  item_name     text not null,
  created_at    timestamptz not null default now()
);

create index card_redemptions_user_idx on card_redemptions (user_id, created_at desc);

alter table card_redemptions enable row level security;

-- Read own, and nothing else. There is deliberately no insert policy: only
-- create_order(), which is security definer, may write a redemption.
create policy "card redemptions read own" on card_redemptions
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------------ balance
-- ponytail: the free cup earns its own punch, because it is a real cup and
-- excluding one unit of a multi-unit line needs per-unit accounting that buys
-- nothing. Effective cost after the first card is 11 paid cups per free one.
-- If that ever matters, store redeemed units on card_redemptions and subtract.
create function card_punches(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 2
       + coalesce((select sum(oi.quantity)::integer
                     from order_items oi
                     join orders o on o.id = oi.order_id
                    where o.user_id = p_user
                      and o.status <> 'cancelled'
                      and oi.earns_punch), 0)
       - coalesce((select sum(cr.punches_spent)::integer
                     from card_redemptions cr
                    where cr.user_id = p_user), 0);
$$;

-- ---------------------------------------------------------------- my card
-- No user argument on purpose: one account must not be able to read another's
-- card by passing an id.
create function my_card()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null
      then jsonb_build_object('punches', 0, 'ready', false, 'redeemed_count', 0)
    else jsonb_build_object(
      'punches',        card_punches(auth.uid()),
      'ready',          card_punches(auth.uid()) >= 12,
      'redeemed_count', (select count(*) from card_redemptions where user_id = auth.uid())
    )
  end;
$$;

-- ---------------------------------------------------------------- my usual
-- Most-ordered item by summed quantity, carrying the modifier set from the most
-- recent order of it — so "order again" reproduces the drink, not just the item.
create function my_usual()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select oi.menu_item_id,
           sum(oi.quantity) as total,
           max(o.placed_at) as last_at
      from order_items oi
      join orders o on o.id = oi.order_id
     where o.user_id = auth.uid()
       and o.status <> 'cancelled'
       and oi.menu_item_id is not null
     group by oi.menu_item_id
     order by total desc, last_at desc
     limit 1
  )
  select jsonb_build_object(
    'menu_item_id',  m.id,
    'name',          m.name,
    'base_price',    m.base_price,
    'daily_stock',   m.daily_stock,
    'image_url',     m.image_url,
    'times_ordered', r.total,
    'selected_modifiers', coalesce((
      select oi2.selected_modifiers
        from order_items oi2
        join orders o2 on o2.id = oi2.order_id
       where o2.user_id = auth.uid()
         and oi2.menu_item_id = m.id
       order by o2.placed_at desc
       limit 1), '[]'::jsonb)
  )
    from ranked r
    join menu_items m on m.id = r.menu_item_id;
$$;

revoke all on function card_punches(uuid) from public, anon, authenticated;
revoke all on function my_card() from public;
revoke all on function my_usual() from public;
grant execute on function my_card() to authenticated;
grant execute on function my_usual() to authenticated;
