begin;

do $$
declare
  v_owner   uuid;
  v_manager uuid;
  v_barista uuid;
  v_cat     uuid;
  v_item    uuid;
  v_order   orders;
begin
  insert into staff (display_name, role) values ('Discount Owner', 'owner') returning id into v_owner;
  insert into staff (display_name, role) values ('Discount Manager', 'manager') returning id into v_manager;
  insert into staff (display_name, role) values ('Discount Barista', 'staff') returning id into v_barista;

  insert into service_days (day) values ((now() at time zone shop_tz())::date)
  on conflict (day) do update set closed_at = null;

  insert into menu_categories (slug, name, vat_rate) values ('test-discount', 'Test Discount', 0.11)
  returning id into v_cat;

  insert into menu_items (category_id, slug, name, base_price, daily_stock)
  values (v_cat, 'test-discount-item', 'Test Discount Item', 10.00, 10)
  returning id into v_item;

  v_order := create_order(
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 1, 'modifiers', '[]'::jsonb)),
    'Discount', '', 'counter');

  -- a barista may not discount
  begin
    perform discount_order(v_order.id, v_barista, 'percent', 10, 'Because');
    assert false, 'a barista may not discount';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;

  -- a reason is not optional
  begin
    perform discount_order(v_order.id, v_manager, 'percent', 10, '  ');
    assert false, 'a discount without a reason is not a discount';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'A reason%', 'and it asks for one';
  end;

  -- percent
  perform discount_order(v_order.id, v_manager, 'percent', 10, 'Spilled it');
  assert (select total from orders where id = v_order.id) = 9.00, '10% off 10.00';
  assert (select discount_total from orders where id = v_order.id) = 1.00, 'recorded';
  -- VAT follows the money down
  assert (select tax_total from orders where id = v_order.id)
       = round(0.99 * 0.9, 2), 'tax is prorated, not left at the old total';

  -- replaces, never stacks
  perform discount_order(v_order.id, v_manager, 'percent', 10, 'Spilled it');
  assert (select total from orders where id = v_order.id) = 9.00,
         'a second identical discount is not a second discount';

  -- comp
  perform discount_order(v_order.id, v_manager, 'comp', 0, 'On the house');
  assert (select total from orders where id = v_order.id) = 0, 'a comp is the lot';

  -- a settled order is closed to it
  perform advance_order(v_order.id, 'cancelled', v_manager);
  begin
    perform discount_order(v_order.id, v_manager, 'percent', 10, 'Too late');
    assert false, 'a voided order cannot be discounted';
  exception when sqlstate 'P0001' then null;
  end;

  raise notice 'discount: all assertions passed';
end $$;

rollback;
