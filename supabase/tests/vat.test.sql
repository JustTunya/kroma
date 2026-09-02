begin;

do $$
declare
  v_cat   uuid;
  v_item  uuid;
  v_order orders;
  v_lines jsonb;
begin
  insert into service_days (day) values ((now() at time zone shop_tz())::date)
  on conflict (day) do update set closed_at = null;

  insert into menu_categories (slug, name, vat_rate)
  values ('test-vat', 'Test VAT', 0.11) returning id into v_cat;

  insert into menu_items (category_id, slug, name, base_price)
  values (v_cat, 'test-vat-item', 'Test VAT Item', 11.10) returning id into v_item;

  v_lines := order_lines(
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 2, 'modifiers', '[]'::jsonb)),
    false);

  assert (v_lines -> 0 ->> 'vat_rate')::numeric = 0.11,
         'the line carries its category rate';

  v_order := create_order(
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 2, 'modifiers', '[]'::jsonb)),
    'VAT', '', 'counter');

  -- 22.20 gross at 11% → 22.20 - 22.20/1.11 = 2.20
  assert v_order.total = 22.20,     'the price the customer pays is unchanged';
  assert v_order.tax_total = 2.20,  'VAT is extracted, never added';
  assert (select vat_rate from order_items where order_id = v_order.id) = 0.11,
         'the rate is snapshotted on the line';

  -- a rate change must not rewrite what was already sold
  update menu_categories set vat_rate = 0.21 where id = v_cat;
  assert (select vat_rate from order_items where order_id = v_order.id) = 0.11,
         'history keeps the rate it was sold at';

  raise notice 'vat: all assertions passed';
end $$;

rollback;
