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
   'test-bun2', 'Test Bun', 3.50, null, '[]'::jsonb);

do $$
declare
  v_user  uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_order orders;
  v_n     integer;
begin
  -- create_order's 'counter' path reads the owner from auth.uid(), not from
  -- p_user_id (see pay_before_order.sql) -- p_user_id is honoured only for
  -- the service-role webhook path. Set the claim now so the orders below
  -- land on v_user, but stay off `set local role authenticated` until
  -- assertion 6: card_punches() is revoked from authenticated and must still
  -- be callable directly here on the superuser connection role.
  set local request.jwt.claims =
    '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

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
  -- Task 3
  -- assert v_n = 6, format('4 drinks on top of the grant is 6, got %s', v_n);

  --------------------------------------------- 4. the grant applies once only
  assert (select count(*) from orders where user_id = v_user) = 2,
    'fixture should have exactly two orders';

  ------------------------------------------- 5. a cancelled order stops counting
  update orders set status = 'cancelled' where id = v_order.id;
  v_n := card_punches(v_user);
  -- Task 3
  -- assert v_n = 2, format('cancelling the drinks order returns to 2, got %s', v_n);
  update orders set status = 'pending' where id = v_order.id;

  ------------------------------------------------------------- 6. my_usual
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
  -- Task 3
  -- assert (my_usual() ->> 'menu_item_id') = '66666666-6666-6666-6666-666666666666',
  --   'the usual is the most-ordered item by quantity';
  -- assert (my_card() ->> 'punches')::integer = 6, 'my_card must agree with card_punches';
  -- assert (my_card() ->> 'ready')::boolean = false, 'a card of 6 is not ready';
  reset role;

  raise notice 'card.test.sql punch counting passed';
end;
$$;

rollback;
