-- supabase/tests/profiles.test.sql
-- Run against the hosted database, inside begin/rollback.
begin;

-- Two users, so the policies have something to keep apart.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b@example.test');

insert into profiles (id, display_name, phone)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana', '+40700000001');

do $$
declare
  v_seen    integer;
  v_name    text;
  v_item_id uuid;
  v_failed  boolean;
begin
  ------------------------------------------------------------- 1. own row
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

  select count(*) into v_seen from profiles;
  assert v_seen = 1, format('A should see exactly its own profile, saw %s', v_seen);

  update profiles set display_name = 'Ana M' where id = auth.uid();
  select display_name into v_name from profiles where id = auth.uid();
  assert v_name = 'Ana M', 'A must be able to update its own profile';

  ---------------------------------------------------- 2. somebody else's row
  set local request.jwt.claims =
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

  select count(*) into v_seen from profiles;
  assert v_seen = 0, format('B must not see A''s profile, saw %s', v_seen);

  update profiles set display_name = 'stolen'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select display_name into v_name from profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  -- read back as the owner, since B cannot see the row at all
  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
  select display_name into v_name from profiles where id = auth.uid();
  assert v_name = 'Ana M', 'B must not be able to write A''s profile';

  --------------------------------------------------------- 3. insert own row
  -- The upsert path (no signup trigger, see the migration) leans entirely on
  -- "insert own" under RLS. The select/update checks above don't exercise it.
  set local request.jwt.claims =
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

  insert into profiles (id, display_name) values (auth.uid(), 'Bogdan');
  select count(*) into v_seen from profiles
   where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  assert v_seen = 1, 'B must be able to insert its own profile row';

  v_failed := false;
  begin
    insert into profiles (id, display_name) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'hijacked');
  exception when sqlstate '42501' then
    v_failed := true;
  end;
  assert v_failed, 'B must not be able to insert a profile row under A''s id';

  ------------------------------------------------------------ 4. favourites
  select id into v_item_id from menu_items limit 1;

  insert into favourites (user_id, menu_item_id) values (auth.uid(), v_item_id);

  select count(*) into v_seen from favourites;
  assert v_seen = 1, format('B should see its own favourite, saw %s', v_seen);

  v_failed := false;
  begin
    insert into favourites (user_id, menu_item_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', v_item_id);
  exception when sqlstate '42501' then
    v_failed := true;
  end;
  assert v_failed, 'B must not be able to insert a favourite under A''s user_id';

  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
  select count(*) into v_seen from favourites;
  assert v_seen = 0, format('A must not see B''s favourites, saw %s', v_seen);

  ----------------------------------------------------- 5. favourites delete
  -- A, still the active session, must not be able to delete B's favourite.
  delete from favourites where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  set local request.jwt.claims =
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
  select count(*) into v_seen from favourites where user_id = auth.uid();
  assert v_seen = 1, 'A''s delete attempt must not remove B''s favourite';

  delete from favourites where user_id = auth.uid();
  select count(*) into v_seen from favourites where user_id = auth.uid();
  assert v_seen = 0, 'B must be able to delete its own favourite';

  reset role;
  raise notice 'profiles.test.sql passed';
end;
$$;

rollback;
