-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

insert into menu_categories (id, slug, name, earns_punch)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'board-cat', 'Board Category', true);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'board-bun', 'Board Bun', 3.50, 10);

-- transitions, permissions and the stock consequence of each ending -----------
do $$
declare
  v_manager uuid;
  v_barista uuid;
  v_station uuid;
  v_order   uuid;
  v_stock   integer;
  v_state   jsonb;
begin
  insert into staff (display_name, role) values ('Board Manager', 'manager')
  returning id into v_manager;

  insert into staff (display_name, role) values ('Board Barista', 'staff')
  returning id into v_barista;

  insert into staff (display_name, kind, role)
  values ('Board Station', 'station', 'staff')
  returning id into v_station;

  insert into orders (status, customer_name, subtotal, total, payment_method)
  values ('paid', 'Test Customer', 7.00, 7.00, 'counter')
  returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 2, 7.00, true);

  -- forward ------------------------------------------------------------------
  v_state := advance_order(v_order, 'preparing', v_barista, v_station);
  assert v_state ->> 'status' = 'preparing', 'paid advances to preparing';
  assert (select started_at from orders where id = v_order) is not null,
    'preparing stamps started_at';
  assert (select claimed_by from orders where id = v_order) = v_barista,
    'preparing claims the order';

  v_state := advance_order(v_order, 'ready', v_barista, v_station);
  assert (select ready_at from orders where id = v_order) is not null,
    'ready stamps ready_at';

  -- illegal transition -------------------------------------------------------
  begin
    perform advance_order(v_order, 'pending', v_barista, v_station);
    assert false, 'ready must not jump back to pending';
  exception when sqlstate 'P0001' then null;
  end;

  -- permission ---------------------------------------------------------------
  begin
    perform advance_order(v_order, 'cancelled', v_barista, v_station);
    assert false, 'staff must not void';
  exception when sqlstate 'P0001' then null;
  end;

  -- an inactive actor is refused even with a live cookie ---------------------
  update staff set is_active = false where id = v_barista;
  begin
    perform advance_order(v_order, 'collected', v_barista, v_station);
    assert false, 'an inactive actor must be refused';
  exception when sqlstate 'P0001' then null;
  end;
  update staff set is_active = true where id = v_barista;

  v_state := advance_order(v_order, 'collected', v_barista, v_station);
  assert (select collected_at from orders where id = v_order) is not null,
    'collected stamps collected_at';

  -- a refund keeps the stock gone --------------------------------------------
  select daily_stock into v_stock from menu_items
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  v_state := advance_order(v_order, 'refunded', v_manager, v_station);
  assert v_state ->> 'status' = 'refunded', 'manager may refund';
  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000001') = v_stock,
    'a refund does NOT restore stock';

  -- every transition is audited ----------------------------------------------
  assert (select count(*) from staff_events
           where subject_id = v_order and action like 'order.%') >= 4,
    'each transition wrote an audit row';

  raise notice 'order_board.test.sql: transitions passed';
end $$;

-- a void DOES restore stock ---------------------------------------------------
do $$
declare
  v_manager uuid;
  v_order   uuid;
begin
  insert into staff (display_name, role) values ('Void Manager', 'manager')
  returning id into v_manager;

  update menu_items set daily_stock = 5
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  insert into orders (status, subtotal, total, payment_method)
  values ('paid', 3.50, 3.50, 'counter') returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 1, 3.50);

  perform advance_order(v_order, 'cancelled', v_manager, null);

  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 6,
    'a void restores stock';

  raise notice 'order_board.test.sql: void restores stock';
end $$;

-- set_item_stock is the only way daily_stock moves from the dashboard ---------
do $$
declare
  v_barista uuid;
begin
  insert into staff (display_name, role) values ('Stock Barista', 'staff')
  returning id into v_barista;

  perform set_item_stock('bbbbbbbb-0000-0000-0000-000000000001', 0, v_barista, null);

  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
    'any staff member may 86 an item';

  assert (select count(*) from staff_events
           where staff_id = v_barista and action = 'item.86') = 1,
    'the 86 was audited';

  begin
    perform set_item_stock('bbbbbbbb-0000-0000-0000-000000000001', -1, v_barista, null);
    assert false, 'negative stock must be refused';
  exception when sqlstate 'P0001' then null;
  end;

  raise notice 'order_board.test.sql: stock control passed';
end $$;

-- a refunded order stops earning punches --------------------------------------
do $$
declare
  v_user   uuid := gen_random_uuid();
  v_order  uuid;
  v_before integer;
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'punch-test@kroma.local');

  v_before := card_punches(v_user);

  insert into orders (user_id, status, subtotal, total, payment_method)
  values (v_user, 'refunded', 3.50, 3.50, 'counter') returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 1, 3.50, true);

  assert card_punches(v_user) = v_before,
    'a refunded order must not mint a punch';

  -- and a collected one still does, so the filter is not simply broken
  update orders set status = 'collected' where id = v_order;
  assert card_punches(v_user) = v_before + 1,
    'a collected order still earns its punch';

  raise notice 'order_board.test.sql: refunds do not mint punches';
end $$;

rollback;
