begin;

do $$
declare
  v_owner   uuid;
  v_manager uuid;
  v_barista uuid;
  v_cat     uuid;
  v_item    menu_items;
  v_a       uuid;
  v_b       uuid;
begin
  insert into staff (display_name, role) values ('Menu Owner', 'owner') returning id into v_owner;
  insert into staff (display_name, role) values ('Menu Manager', 'manager') returning id into v_manager;
  insert into staff (display_name, role) values ('Menu Barista', 'staff') returning id into v_barista;

  insert into menu_categories (slug, name) values ('test-menu-admin', 'Test Menu Admin')
  returning id into v_cat;

  -- a barista may not edit the menu
  begin
    perform menu_upsert(v_barista, jsonb_build_object('name','X','base_price',1,
      'category_id', v_cat, 'modifiers', '[]'::jsonb));
    assert false, 'a barista may not edit the menu';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;

  -- a manager may, and the slug comes from the name
  v_item := menu_upsert(v_manager, jsonb_build_object(
    'name', 'Test Cortado', 'base_price', 4.20, 'category_id', v_cat,
    'par_stock', null, 'modifiers', '[]'::jsonb));
  assert v_item.slug = 'test-cortado', 'the slug is derived from the name';

  -- a price change is audited as a diff, not as a row dump
  v_item := menu_upsert(v_manager, jsonb_build_object(
    'id', v_item.id, 'name', 'Test Cortado', 'base_price', 4.50,
    'category_id', v_cat, 'modifiers', '[]'::jsonb));
  assert (select detail -> 'base_price' ->> 'from' from staff_events
           where action = 'menu.edit' order by id desc limit 1) = '4.20',
         'the audit row carries the old price';

  -- a malformed modifier group is refused at the door
  begin
    perform menu_upsert(v_manager, jsonb_build_object(
      'name', 'Bad', 'base_price', 1, 'category_id', v_cat,
      'modifiers', '[{"name":"Milk","options":[{"name":"Oat"}]}]'::jsonb));
    assert false, 'an option without a priceOffset is not a modifier group';
  exception when sqlstate 'P0001' then
    assert sqlerrm like '%modifier%', 'and says which part is wrong';
  end;

  -- reorder
  v_a := (menu_upsert(v_manager, jsonb_build_object(
    'name', 'Test A', 'base_price', 1, 'category_id', v_cat, 'modifiers', '[]'::jsonb))).id;
  v_b := (menu_upsert(v_manager, jsonb_build_object(
    'name', 'Test B', 'base_price', 1, 'category_id', v_cat, 'modifiers', '[]'::jsonb))).id;

  perform menu_reorder(v_manager, array[v_b, v_a]);
  assert (select sort_order from menu_items where id = v_b) = 0, 'first is first';

  -- an owner may edit a category
  perform menu_category_upsert(v_owner, jsonb_build_object(
    'id', v_cat, 'name', 'Test Menu Admin', 'vat_rate', 0.21));
  assert (select vat_rate from menu_categories where id = v_cat) = 0.21,
         'the category rate updates by id';

  raise notice 'menu_admin: all assertions passed';
end $$;

rollback;
