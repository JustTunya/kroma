-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

do $$
declare
  v_owner   uuid;
  v_barista uuid;
  v_day     service_days;
  v_item    uuid;
begin
  insert into staff (display_name, role, pin_hash)
  values ('Test Owner', 'owner', extensions.crypt('1111', extensions.gen_salt('bf', 4)))
  returning id into v_owner;

  insert into staff (display_name, role, pin_hash)
  values ('Test Barista', 'staff', extensions.crypt('2222', extensions.gen_salt('bf', 4)))
  returning id into v_barista;

  -- permissions ---------------------------------------------------------------
  assert staff_can('staff', 'shop.open'),        'anyone on shift opens the day';
  assert not staff_can('staff', 'shop.close'),   'a barista does not count the drawer';
  assert staff_can('manager', 'shop.close'),     'a manager counts the drawer';

  -- no day yet ----------------------------------------------------------------
  delete from service_days where day = (now() at time zone shop_tz())::date;
  assert current_service_day() is null, 'no open day before anyone opens one';

  -- a batch item to reset -----------------------------------------------------
  insert into menu_items (category_id, slug, name, base_price, par_stock, daily_stock)
  values ((select id from menu_categories order by sort_order limit 1),
          'test-bun', 'Test Bun', 4.00, 12, 0)
  returning id into v_item;

  -- opening -------------------------------------------------------------------
  v_day := open_service(v_barista);
  assert v_day.day = (now() at time zone shop_tz())::date, 'opens the shop-local day';
  assert v_day.next_number = 1,                            'tickets start at one';
  assert current_service_day() = v_day.day,                'the day is now open';
  assert (select daily_stock from menu_items where id = v_item) = 12,
         'opening resets daily_stock to par';
  assert (select par_stock from menu_items where id = v_item) = 12,
         'opening reads par_stock but never rewrites it';

  -- idempotent ------------------------------------------------------------
  -- Also the on-conflict path: open_service's insert races an existing row
  -- on the real primary key, so this second call goes through the exact
  -- "someone already opened today" branch a second concurrent iPad would hit.
  update menu_items set daily_stock = 3 where id = v_item;
  v_day := open_service(v_barista);
  assert (select daily_stock from menu_items where id = v_item) = 3,
         'a second open writes nothing';
  assert (select par_stock from menu_items where id = v_item) = 12,
         'par_stock still survives a second open';
  assert (select count(*) from staff_events where action = 'shop.open') = 1,
         'and audits nothing';

  -- overrides -----------------------------------------------------------------
  delete from service_days where day = (now() at time zone shop_tz())::date;
  v_day := open_service(v_barista, jsonb_build_object(v_item::text, 5));
  assert (select daily_stock from menu_items where id = v_item) = 5,
         'the opening screen count beats par';

  raise notice 'service_day: all assertions passed';
end $$;

rollback;
