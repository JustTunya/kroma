-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

insert into menu_categories (id, slug, name, earns_punch)
values ('cccccccc-0000-0000-0000-000000000001', 'close-cat', 'Close Category', true);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock)
values ('dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        'close-bun', 'Close Bun', 5.00, 10);

do $$
declare
  v_owner   uuid;
  v_barista uuid;
  v_order   orders;
  v_online  orders;
  v_live    orders;
  v_report  jsonb;
  v_items   jsonb;
begin
  insert into staff (display_name, role, pin_hash)
  values ('Close Owner', 'owner', extensions.crypt('1111', extensions.gen_salt('bf', 4)))
  returning id into v_owner;

  insert into staff (display_name, role, pin_hash)
  values ('Close Barista', 'staff', extensions.crypt('2222', extensions.gen_salt('bf', 4)))
  returning id into v_barista;

  insert into service_days (day, float_cash) values ((now() at time zone shop_tz())::date, 100.00)
  on conflict (day) do update set closed_at = null, float_cash = 100.00;

  v_items := jsonb_build_array(jsonb_build_object(
    'menu_item_id', 'dddddddd-0000-0000-0000-000000000001', 'quantity', 1, 'modifiers', '[]'::jsonb));

  -- a counter order, taken as cash --------------------------------------------
  v_order := create_order(v_items, 'Close', '', 'counter');

  -- tender ---------------------------------------------------------------
  begin
    perform advance_order(v_order.id, 'paid', v_owner);
    assert false, 'a counter order cannot be paid without a tender';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Cash or card?', 'and it asks which';
  end;

  perform advance_order(v_order.id, 'paid', v_owner, null, 'cash');
  assert (select settled_as from orders where id = v_order.id) = 'cash',
         'the tender is recorded where the money arrived';

  -- stepping back hands the money back --------------------------------------
  perform advance_order(v_order.id, 'pending', v_owner);
  assert (select settled_as from orders where id = v_order.id) is null,
         'stepping back clears the tender';

  perform advance_order(v_order.id, 'paid', v_owner, null, 'cash');

  -- carried through to collected: "live" means still on the pass, and a paid
  -- order that has not been picked up yet still is.
  perform advance_order(v_order.id, 'preparing', v_owner);
  perform advance_order(v_order.id, 'ready', v_owner);
  perform advance_order(v_order.id, 'collected', v_owner);

  -- an online order never asks ----------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_online := create_order(v_items, 'Close Online', '', 'online', null, 'cs_close_test', 'pi_close_test');
  perform set_config('request.jwt.claims', '', true);
  assert (select settled_as from orders where id = v_online.id) = 'online',
         'a card order settles itself';

  perform advance_order(v_online.id, 'preparing', v_owner);
  perform advance_order(v_online.id, 'ready', v_owner);
  perform advance_order(v_online.id, 'collected', v_owner);

  -- one order left live on the pass -------------------------------------------
  v_live := create_order(v_items, 'Live', '', 'counter');

  -- the report ---------------------------------------------------------------
  v_report := service_report(v_owner, current_service_day());
  assert (v_report ->> 'cash')::numeric = 5.00,    'cash is what came in as cash';
  assert (v_report ->> 'orders')::int = 2,         'kept orders are counted (v_live is still pending)';
  assert (v_report ->> 'expected_cash')::numeric
       = (v_report ->> 'float')::numeric + 5.00,   'expected is float plus cash';

  -- closing over live orders is refused --------------------------------------
  begin
    perform close_service(v_owner, 105.00, '{}'::jsonb);
    assert false, 'a live order blocks the close';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'Still on the pass%', 'and names what is open';
  end;

  perform advance_order(v_live.id, 'cancelled', v_owner);
  v_report := close_service(v_owner, 105.00, '{"50":2}'::jsonb);

  assert (select closed_at from service_days where day = current_date) is not null,
         'the day is shut';
  assert (v_report ->> 'variance')::numeric = 0,   'a correct count is square';
  assert (select report from service_days where day = current_date) is not null,
         'and the report is frozen on the row';

  -- a barista may not ---------------------------------------------------------
  begin
    perform close_service(v_barista, 0, '{}'::jsonb);
    assert false, 'a barista does not count the drawer';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;

  raise notice 'close_service: all assertions passed';
end $$;

rollback;
