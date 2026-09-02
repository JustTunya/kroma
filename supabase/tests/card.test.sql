-- supabase/tests/card.test.sql
-- Run against the hosted database, inside begin/rollback.
begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('cccccccc-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'c@example.test');

insert into menu_categories (id, slug, name, earns_punch)
values ('44444444-4444-4444-4444-444444444444', 'test-drinks', 'Test Drinks', true),
       ('55555555-5555-5555-5555-555555555555', 'test-food',   'Test Food',   false);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock, modifiers)
values
  ('66666666-6666-6666-6666-666666666666',
   '44444444-4444-4444-4444-444444444444',
   'test-cortado', 'Test Cortado', 4.20, null, '[]'::jsonb),
  ('77777777-7777-7777-7777-777777777777',
   '55555555-5555-5555-5555-555555555555',
   'test-bun2', 'Test Bun', 3.50, null, '[]'::jsonb),
  -- Modifier-bearing drink, for block 12: the real UI (lib/cart.ts) keeps a
  -- separate line per modifier combination, so two lines of the same
  -- menu_item_id with different modifiers is the shape a genuine cart
  -- produces, not just a synthetic duplicate. Both options carry the same
  -- priceOffset so the total is deterministic regardless of which of the two
  -- equal-price lines the loop happens to free first.
  ('88888888-8888-8888-8888-888888888888',
   '44444444-4444-4444-4444-444444444444',
   'test-latte2', 'Test Latte', 4.00, null,
   '[{"name":"Milk Choice","options":[
       {"name":"Whole Milk","priceOffset":0},
       {"name":"Skim Milk","priceOffset":0}]}]'::jsonb);

do $$
declare
  v_user   uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_order  orders;
  v_n      integer;
  -- Declared here, not inside the nested begin/exception blocks below: a
  -- variable declared in a nested block's own `declare` only lives until
  -- that block's `end`, and every assert that reads it runs after that.
  v_failed  boolean;
  v_failed2 boolean;
  v_failed3 boolean;
  v_errmsg  text;
begin
  -- create_order's 'counter' path reads the owner from auth.uid(), not from
  -- p_user_id (see pay_before_order.sql) -- p_user_id is honoured only for
  -- the service-role webhook path. Set the claim now so the orders below
  -- land on v_user, but stay off `set local role authenticated` until
  -- assertion 6: card_punches() is revoked from authenticated and must still
  -- be callable directly here on the superuser connection role.
  set local request.jwt.claims =
    '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

  -- create_order() now refuses a closed shop. Every fixture opens the day.
  -- next_number is reset too so a stray real-world count doesn't leak into
  -- this test's ticket numbers -- safe only because this whole file rolls back.
  insert into service_days (day) values ((now() at time zone shop_tz())::date)
  on conflict (day) do update set closed_at = null, next_number = 1;

  --------------------------------------------------- 1. the signup grant
  v_n := card_punches(v_user);
  assert v_n = 2, format('a new card starts at 2, got %s', v_n);

  --------------------------------------------------- 2. pastry earns nothing
  v_order := create_order(
    '[{"menu_item_id":"77777777-7777-7777-7777-777777777777","quantity":3,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  v_n := card_punches(v_user);
  assert v_n = 2, format('pastry must not punch, got %s', v_n);

  --------------------------------------------------- 3. drinks earn per unit
  v_order := create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":4,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  v_n := card_punches(v_user);
  assert v_n = 6, format('4 drinks on top of the grant is 6, got %s', v_n);

  --------------------------------------------- 4. the grant applies once only
  assert (select count(*) from orders where user_id = v_user) = 2,
    'fixture should have exactly two orders';

  ------------------------------------------- 5. a cancelled order stops counting
  update orders set status = 'cancelled' where id = v_order.id;
  v_n := card_punches(v_user);
  assert v_n = 2, format('cancelling the drinks order returns to 2, got %s', v_n);

  -- 5b. and so does a refund. Without 'refunded' in card_punches' exclusion
  -- list a refunded order keeps its punches, which is refunds minting free
  -- coffee. Added with the store dashboard, which introduced the status.
  update orders set status = 'refunded' where id = v_order.id;
  v_n := card_punches(v_user);
  assert v_n = 2, format('a refunded drinks order also returns to 2, got %s', v_n);

  update orders set status = 'pending' where id = v_order.id;

  ------------------------------------------------------------- 6. my_usual
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
  assert (my_usual() ->> 'menu_item_id') = '66666666-6666-6666-6666-666666666666',
    'the usual is the most-ordered item by quantity';
  assert (my_card() ->> 'punches')::integer = 6, 'my_card must agree with card_punches';
  assert (my_card() ->> 'ready')::boolean = false, 'a card of 6 is not ready';
  reset role;

  ---------------------------------------------- 7. a card that is not full
  v_failed := false;
  begin
    v_order := create_order(
      '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '66666666-6666-6666-6666-666666666666');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  -- Not an error: the spec's accepted loss. The order is placed, undiscounted,
  -- with no redemption row. Assert that, not a raise.
  assert not v_failed, 'a short card must not fail the order';
  assert v_order.total = 4.20,
    format('a short card must charge full price, not discount, got %s', v_order.total);
  assert (select count(*) from card_redemptions where user_id = v_user) = 0,
    'a short card must not write a redemption';

  ------------------------------------------------- 8. fill the card and redeem
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":10,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  assert card_punches(v_user) >= 12,
    format('card should be full, got %s', card_punches(v_user));

  -- Quantity 3, one of them free: 4.20 * 3 - 4.20 = 8.40.
  v_order := create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":3,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user, null, null,
    '66666666-6666-6666-6666-666666666666');
  assert v_order.total = 8.40,
    format('one free unit off a line of 3 leaves 8.40, got %s', v_order.total);
  assert (select count(*) from card_redemptions where order_id = v_order.id) = 1,
    'a redemption row must be written';
  assert (select punches_spent from card_redemptions where order_id = v_order.id) = 12,
    'a redemption burns exactly 12';

  ------------------------------------------ 9. redeeming something not in the cart
  -- Block 8's redemption spent the card back down below 12 (it earns back only
  -- 3 of the 12 it spends, per the "one paid cup short of the next free one"
  -- economics in card.sql -- card is 8 here). create_order silently drops an
  -- out-of-range redeem attempt instead of raising (assertion 7's asymmetry),
  -- so without topping the card back up here this block would exercise that
  -- silent-drop path instead of the "item not in cart" validation it's meant
  -- to test. Top up first so the redeem attempt actually reaches order_lines.
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":4,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  assert card_punches(v_user) >= 12,
    format('card should be full again after topping up, got %s', card_punches(v_user));

  v_failed2 := false;
  begin
    perform create_order(
      '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '77777777-7777-7777-7777-777777777777');
  exception when sqlstate 'P0001' then
    v_failed2 := true;
    v_errmsg  := sqlerrm;
  end;
  assert v_failed2, 'redeeming an item that is not in the cart must raise';
  -- Bare P0001 is every validation error order_lines raises. Pin the text so
  -- this can't pass because a different check happened to fire first.
  assert v_errmsg = 'That drink is not in this order.',
    format('wrong error for a redeem target absent from the cart: %s', v_errmsg);

  ----------------------------------------------- 10. redeeming a non-drink
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":20,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  v_failed3 := false;
  begin
    perform create_order(
      '[{"menu_item_id":"77777777-7777-7777-7777-777777777777","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '77777777-7777-7777-7777-777777777777');
  exception when sqlstate 'P0001' then
    v_failed3 := true;
    v_errmsg  := sqlerrm;
  end;
  assert v_failed3, 'a pastry cannot be the free drink';
  assert v_errmsg = 'Test Bun — the card is for drinks.',
    format('wrong error for redeeming a non-drink: %s', v_errmsg);

  ------------------------------------ 11. one free unit per ORDER, not per line
  -- Two separate lines of the same redeemed drink. The bug this covers: the
  -- per-line guard in order_lines used to test only "is this line's item the
  -- redeemed one", so every matching line got its own free unit. Assert the
  -- total, not just that the call succeeded -- a total of 0.00 here (both
  -- lines freed) is the regression.
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":10,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  assert card_punches(v_user) >= 12,
    format('card should be full before the two-line redemption, got %s', card_punches(v_user));

  v_order := create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]},
      {"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user, null, null,
    '66666666-6666-6666-6666-666666666666');
  assert v_order.total = 4.20,
    format('two 1-unit lines of the same drink, one redeemed, leaves exactly one paid cup (4.20), got %s',
      v_order.total);
  assert (select count(*) from card_redemptions where order_id = v_order.id) = 1,
    'still exactly one redemption row for the order, not one per line';

  --------------------------- 12. same drink, two different modifier selections
  -- The shape lib/cart.ts actually produces: same menu_item_id, different
  -- modifiers, kept as separate lines (lib/cart.test.ts asserts this). Both
  -- options here carry priceOffset 0, so the total is 4.00 (one paid cup)
  -- regardless of which of the two equal-price lines the fix frees first.
  perform create_order(
    '[{"menu_item_id":"88888888-8888-8888-8888-888888888888","quantity":10,
       "modifiers":[{"group":"Milk Choice","option":"Whole Milk"}]}]'::jsonb,
    'C', null, 'counter', v_user);
  assert card_punches(v_user) >= 12,
    format('card should be full before the modifier-shaped redemption, got %s', card_punches(v_user));

  v_order := create_order(
    '[{"menu_item_id":"88888888-8888-8888-8888-888888888888","quantity":1,
       "modifiers":[{"group":"Milk Choice","option":"Whole Milk"}]},
      {"menu_item_id":"88888888-8888-8888-8888-888888888888","quantity":1,
       "modifiers":[{"group":"Milk Choice","option":"Skim Milk"}]}]'::jsonb,
    'C', null, 'counter', v_user, null, null,
    '88888888-8888-8888-8888-888888888888');
  assert v_order.total = 4.00,
    format('two 1-unit lines of the same drink with different modifiers, one redeemed, leaves 4.00, got %s',
      v_order.total);

  raise notice 'card.test.sql punch counting passed';
end;
$$;

rollback;
