-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
--
-- Covers the two ways an order comes off the pass early — nobody came for it,
-- and the customer never meant to place it — and the three things that must
-- never be confused: the stock, the money, and who is allowed.
begin;

insert into menu_categories (id, slug, name, earns_punch)
values ('aaaaaaaa-0000-0000-0000-000000000011', 'removal-cat', 'Removal Category', true);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock)
values ('bbbbbbbb-0000-0000-0000-000000000011',
        'aaaaaaaa-0000-0000-0000-000000000011',
        'removal-bun', 'Removal Bun', 3.50, 10);

-- nobody came for it ----------------------------------------------------------
do $$
declare
  v_barista uuid;
  v_manager uuid;
  v_order   uuid;
  v_stock   integer;
  v_state   jsonb;
begin
  insert into staff (display_name, role) values ('Abandon Barista', 'staff')
  returning id into v_barista;
  insert into staff (display_name, role) values ('Abandon Manager', 'manager')
  returning id into v_manager;

  insert into orders (status, subtotal, total, payment_method, ready_at)
  values ('ready', 3.50, 3.50, 'counter', now()) returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000011',
          'Removal Bun', 3.50, 1, 3.50, true);

  -- Fresh on the bar: this is still a manager's write-off, because the
  -- customer may be walking through the door.
  begin
    perform advance_order(v_order, 'abandoned', v_barista, null);
    assert false, 'staff must not abandon an order that just went ready';
  exception when sqlstate 'P0001' then null;
  end;

  -- Half an hour later it is nobody's, and the closing barista owns it.
  update orders set ready_at = now() - interval '31 minutes' where id = v_order;

  select daily_stock into v_stock from menu_items
   where id = 'bbbbbbbb-0000-0000-0000-000000000011';

  v_state := advance_order(v_order, 'abandoned', v_barista, null);
  assert v_state ->> 'status' = 'abandoned', 'staff may abandon a stale order';
  assert (v_state ->> 'refund_owed')::boolean = false,
    'an uncollected order owes no refund — it was made and binned';
  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000011') = v_stock,
    'an abandoned order does NOT restore stock';
  assert (select count(*) from staff_events
           where subject_id = v_order and action = 'order.abandon') = 1,
    'the abandon was audited under its own action';

  -- It is an ending, not a lane.
  begin
    perform advance_order(v_order, 'collected', v_manager, null);
    assert false, 'an abandoned order must not move again';
  exception when sqlstate 'P0001' then null;
  end;

  raise notice 'order_removal.test.sql: abandon passed';
end $$;

-- an abandoned order mints no loyalty -----------------------------------------
do $$
declare
  v_user   uuid := gen_random_uuid();
  v_order  uuid;
  v_before integer;
begin
  v_before := card_punches(v_user);

  insert into orders (status, subtotal, total, payment_method, user_id, ready_at)
  values ('ready', 7.00, 7.00, 'counter', v_user, now() - interval '31 minutes')
  returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000011',
          'Removal Bun', 3.50, 2, 7.00, true);

  assert card_punches(v_user) = v_before + 2, 'a live order earns its punches';

  perform advance_order(v_order, 'abandoned',
    (select id from staff where display_name = 'Abandon Barista'), null);

  -- Otherwise "order it, never come" is the cheapest free coffee in Cluj.
  assert card_punches(v_user) = v_before,
    'an abandoned order earns no punches';

  raise notice 'order_removal.test.sql: punches passed';
end $$;

-- the customer's own cancel ---------------------------------------------------
do $$
declare
  v_token uuid;
  v_order uuid;
  v_stock integer;
  v_state jsonb;
begin
  update menu_items set daily_stock = 5
   where id = 'bbbbbbbb-0000-0000-0000-000000000011';

  insert into orders (status, subtotal, total, payment_method)
  values ('paid', 3.50, 3.50, 'counter')
  returning id, access_token into v_order, v_token;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000011',
          'Removal Bun', 3.50, 1, 3.50);

  v_state := cancel_order_by_token(v_token);
  assert v_state ->> 'status' = 'cancelled', 'a waiting order may be dropped';
  assert (v_state ->> 'refund_owed')::boolean = false,
    'a counter order owes no card refund — the till is the refund';
  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000011') = 6,
    'a customer cancel hands the stock back';
  assert (select count(*) from staff_events
           where subject_id = v_order and action = 'order.cancel_self') = 1,
    'the customer cancel was audited, with no staff_id';

  -- Twice is once.
  begin
    perform cancel_order_by_token(v_token);
    assert false, 'a settled order must not be cancelled again';
  exception when sqlstate 'P0001' then null;
  end;

  raise notice 'order_removal.test.sql: customer cancel passed';
end $$;

-- once the bar has started it, it is not the customer's to drop ---------------
do $$
declare
  v_token uuid;
  v_order uuid;
begin
  insert into orders (status, subtotal, total, payment_method)
  values ('preparing', 3.50, 3.50, 'counter')
  returning id, access_token into v_order, v_token;

  begin
    perform cancel_order_by_token(v_token);
    assert false, 'an order being made must not be cancelled from the phone';
  exception when sqlstate 'P0001' then null;
  end;

  begin
    perform cancel_order_by_token(gen_random_uuid());
    assert false, 'an unknown token must not cancel anything';
  exception when sqlstate 'P0001' then null;
  end;

  raise notice 'order_removal.test.sql: cancel window passed';
end $$;

-- the money side: only a card order that owes money says so -------------------
do $$
declare
  v_manager uuid;
  v_online  uuid;
  v_counter uuid;
  v_token   uuid;
  v_state   jsonb;
begin
  insert into staff (display_name, role) values ('Money Manager', 'manager')
  returning id into v_manager;

  insert into orders (status, subtotal, total, payment_method,
                      stripe_session_id, stripe_payment_intent_id)
  values ('ready', 3.50, 3.50, 'online', 'cs_test_removal', 'pi_test_removal')
  returning id into v_online;

  v_state := advance_order(v_online, 'cancelled', v_manager, null);
  assert (v_state ->> 'refund_owed')::boolean = true,
    'voiding a paid card order owes the money back';

  insert into orders (status, subtotal, total, payment_method)
  values ('ready', 3.50, 3.50, 'counter') returning id into v_counter;

  v_state := advance_order(v_counter, 'cancelled', v_manager, null);
  assert (v_state ->> 'refund_owed')::boolean = false,
    'voiding a counter order owes nothing to Stripe';

  insert into orders (status, subtotal, total, payment_method,
                      stripe_session_id, stripe_payment_intent_id)
  values ('paid', 3.50, 3.50, 'online', 'cs_test_removal_2', 'pi_test_removal_2')
  returning id, access_token into v_online, v_token;

  v_state := cancel_order_by_token(v_token);
  assert (v_state ->> 'refund_owed')::boolean = true,
    'a customer cancelling a card order owes the money back';

  raise notice 'order_removal.test.sql: refund_owed passed';
end $$;

rollback;
