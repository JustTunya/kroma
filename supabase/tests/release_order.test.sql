-- Run against the hosted database, inside begin/rollback.
begin;

insert into menu_categories (id, slug, name)
values ('11111111-1111-1111-1111-111111111111', 'test-cat', 'Test Category');

insert into menu_items (id, category_id, slug, name, base_price, daily_stock, modifiers)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'test-bun', 'Test Bun', 3.50, 10, '[]'::jsonb);

do $$
declare
  v_order    orders;
  v_stock    integer;
  v_doc      jsonb;
  v_released boolean;
  v_count    integer;
begin
  -------------------------------------------------- order_by_token round trip
  -- Two lines of the SAME item: proves the release aggregates instead of
  -- restoring only one of them.
  v_order := create_order(
    '[{"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":2,"modifiers":[]},
      {"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":3,"modifiers":[]}]'::jsonb,
    'Ana', 'no bag', 'online');

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 5, format('10 - 2 - 3 should be 5, got %s', v_stock);

  v_doc := order_by_token(v_order.access_token);
  assert v_doc is not null, 'order_by_token returned nothing';
  assert (v_doc ->> 'order_number')::integer = v_order.order_number, 'wrong order';
  assert v_doc ->> 'customer_name' = 'Ana', 'customer_name missing';
  assert jsonb_array_length(v_doc -> 'items') = 2, 'expected 2 item lines';
  assert v_doc -> 'items' -> 0 ? 'base_price', 'items must expose base_price for Stripe';
  assert not (v_doc ? 'access_token'), 'order_by_token must not echo the token';
  assert not (v_doc ? 'user_id'), 'order_by_token must not expose user_id';

  assert order_by_token('00000000-0000-0000-0000-000000000000'::uuid) is null,
    'an unknown token must return null';

  ------------------------------------------------------------ release_order
  v_released := release_order(v_order.id);
  assert v_released, 'release_order should report success on a pending order';

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 10, format('release must restore all 5, got %s', v_stock);

  assert (select status from orders where id = v_order.id) = 'cancelled',
    'released order must be cancelled';

  -- Idempotency: a replayed webhook must not hand back stock twice.
  v_released := release_order(v_order.id);
  assert not v_released, 'a second release must report no-op';

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 10, format('a second release must not add stock, got %s', v_stock);

  -------------------------------------------------- release_expired_orders
  v_order := create_order(
    '[{"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":4,"modifiers":[]}]'::jsonb,
    'Bogdan', null, 'online');
  update orders set expires_at = now() - interval '1 minute' where id = v_order.id;

  v_count := release_expired_orders();
  assert v_count >= 1, format('expected at least 1 expired release, got %s', v_count);

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 10, format('expired hold must return stock, got %s', v_stock);

  raise notice 'release_order: all assertions passed';
end $$;

rollback;
