-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

-- Fixtures ------------------------------------------------------------------
insert into menu_categories (id, slug, name)
values ('11111111-1111-1111-1111-111111111111', 'test-cat', 'Test Category');

insert into menu_items (id, category_id, slug, name, base_price, daily_stock, modifiers)
values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'test-latte', 'Test Latte', 4.00, null,
   '[{"name":"Milk Choice","options":[
       {"name":"Whole Milk","priceOffset":0},
       {"name":"Oat Milk","priceOffset":0.60}]}]'::jsonb),
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'test-bun', 'Test Bun', 3.50, 3, '[]'::jsonb);

do $$
declare
  v_order  orders;
  v_stock  integer;
  v_failed boolean;
begin
  ---------------------------------------------------------------- 1. prices
  -- The client lies about the price. The database ignores it entirely.
  v_order := create_order(
    '[{"menu_item_id":"22222222-2222-2222-2222-222222222222",
       "quantity":2,
       "basePrice":0.01,
       "modifiers":[{"group":"Milk Choice","option":"Oat Milk","priceOffset":-100}]}]'::jsonb,
    'Test', null, 'counter');

  assert v_order.total = 9.20,
    format('expected total 9.20 ((4.00 + 0.60) * 2), got %s', v_order.total);
  assert v_order.payment_method = 'counter', 'payment_method not stored';
  assert v_order.expires_at is null, 'counter order must not expire';
  assert v_order.pickup_at is not null, 'pickup_at must be set';

  ------------------------------------------------------- 2. unknown option
  v_failed := false;
  begin
    perform create_order(
      '[{"menu_item_id":"22222222-2222-2222-2222-222222222222",
         "quantity":1,
         "modifiers":[{"group":"Milk Choice","option":"Free Milk"}]}]'::jsonb,
      'Test', null, 'counter');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  assert v_failed, 'an unknown modifier option must be rejected';

  ------------------------------------------------------------- 3. overstock
  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 3, format('fixture stock should be 3, got %s', v_stock);

  v_failed := false;
  begin
    perform create_order(
      '[{"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":4,"modifiers":[]}]'::jsonb,
      'Test', null, 'counter');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  assert v_failed, 'ordering more than daily_stock must be rejected';

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 3, format('a rejected order must not touch stock, got %s', v_stock);

  ------------------------------------------- 4. sequential over-buy of a batch
  perform create_order(
    '[{"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":3,"modifiers":[]}]'::jsonb,
    'Test', null, 'counter');

  select daily_stock into v_stock from menu_items
   where id = '33333333-3333-3333-3333-333333333333';
  assert v_stock = 0, format('stock should be 0 after taking all 3, got %s', v_stock);

  v_failed := false;
  begin
    perform create_order(
      '[{"menu_item_id":"33333333-3333-3333-3333-333333333333","quantity":1,"modifiers":[]}]'::jsonb,
      'Test', null, 'counter');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  assert v_failed, 'a depleted batch must reject the next order';

  ------------------------------------------------- 5. missing group selection
  v_failed := false;
  begin
    perform create_order(
      '[{"menu_item_id":"22222222-2222-2222-2222-222222222222","quantity":1,"modifiers":[]}]'::jsonb,
      'Test', null, 'counter');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  assert v_failed, 'omitting a required modifier group must be rejected';

  ------------------------------------------------------- 6. online hold is set
  v_order := create_order(
    '[{"menu_item_id":"22222222-2222-2222-2222-222222222222",
       "quantity":1,
       "modifiers":[{"group":"Milk Choice","option":"Whole Milk"}]}]'::jsonb,
    'Test', null, 'online');
  assert v_order.expires_at is not null, 'online order must hold stock';
  assert v_order.status = 'pending', 'new orders start pending';

  raise notice 'create_order: all assertions passed';
end $$;

rollback;
