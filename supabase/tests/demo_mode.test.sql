begin;

do $$
declare
  v_demo          uuid;
  v_manager       uuid;
  v_cat           uuid;
  v_order         orders;
  v_auth_user_id  uuid;
  v_today         date := (now() at time zone shop_tz())::date;
begin
  insert into staff (display_name, role, is_demo) values ('Test Demo Owner', 'owner', true)
  returning id into v_demo;
  insert into staff (display_name, role) values ('Test Manager', 'manager')
  returning id into v_manager;

  insert into menu_categories (slug, name) values ('test-demo-mode', 'Test Demo Mode')
  returning id into v_cat;

  -- the demo actor cannot edit the menu
  begin
    perform menu_upsert(v_demo, jsonb_build_object('name','X','base_price',1,
      'category_id', v_cat, 'modifiers', '[]'::jsonb));
    assert false, 'the demo actor may not edit the menu';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Shared sandbox — refunds and menu edits are disabled here.',
           'and is told this is the shared sandbox';
  end;

  -- a real manager still can, on the same function
  perform menu_upsert(v_manager, jsonb_build_object('name','Test Item','base_price',1,
    'category_id', v_cat, 'modifiers', '[]'::jsonb));
  assert exists (select 1 from menu_items where name = 'Test Item'),
         'a non-demo actor is unaffected by the guard';

  -- the demo actor cannot delete a menu item either
  begin
    perform menu_item_delete(v_demo, (select id from menu_items where name = 'Test Item'));
    assert false, 'the demo actor may not delete a menu item';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Shared sandbox — refunds and menu edits are disabled here.';
  end;

  -- reset_demo_day clears today's orders but not an older one
  insert into service_days (day, opened_by) values (v_today, v_demo);
  insert into orders (status, payment_method, subtotal, total, service_day, day_number)
  values ('collected', 'counter', 5, 5, v_today, 1)
  returning * into v_order;

  insert into service_days (day, opened_by, closed_at)
  values (v_today - 1, v_demo, now() - interval '1 day');
  insert into orders (status, payment_method, subtotal, total, service_day, day_number, placed_at)
  values ('collected', 'counter', 5, 5, v_today - 1, 1, now() - interval '1 day');

  perform reset_demo_day();

  assert not exists (select 1 from orders where id = v_order.id),
         'today''s order is gone after reset';
  assert not exists (select 1 from service_days where day = v_today),
         'today''s service day is gone after reset';
  assert exists (select 1 from orders where service_day = v_today - 1),
         'yesterday''s order survives the reset';
  assert exists (select 1 from service_days where day = v_today - 1),
         'yesterday''s service day survives the reset';

  -- reset_demo_day clears a PIN lockout on the demo staff row
  update staff set failed_pins = 5, locked_until = now() + interval '15 minutes'
   where id = v_demo;
  perform reset_demo_day();
  assert (select locked_until from staff where id = v_demo) is null,
         'the demo staff row''s lockout clears on reset';

  -- admin_upsert_demo_staff is idempotent and hashes the PIN. Clear is_demo
  -- off the fixture row first — staff_one_demo (a new partial unique index,
  -- this same migration) allows only one is_demo row at a time, and
  -- admin_upsert_demo_staff is about to insert a second one for a different
  -- user_id.
  update staff set is_demo = false where id = v_demo;

  insert into auth.users (id, instance_id, aud, role, email)
  values ('dddddddd-1111-1111-1111-111111111111',
          '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'demo@example.test')
  returning id into v_auth_user_id;

  perform admin_upsert_demo_staff(v_auth_user_id, '1234');
  raise notice 'demo_mode: all assertions passed';
end $$;

rollback;
