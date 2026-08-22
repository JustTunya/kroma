-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

do $$
declare
  v_owner   uuid;
  v_barista uuid;
  v_result  jsonb;
  v_locked  timestamptz;
begin
  -- Fixtures ------------------------------------------------------------------
  insert into staff (display_name, role, pin_hash)
  values ('Test Owner', 'owner', extensions.crypt('1111', extensions.gen_salt('bf', 4)))
  returning id into v_owner;

  insert into staff (display_name, role, pin_hash)
  values ('Test Barista', 'staff', extensions.crypt('2222', extensions.gen_salt('bf', 4)))
  returning id into v_barista;

  -- staff_can -----------------------------------------------------------------
  assert staff_can('staff',   'order.advance'),      'staff may advance';
  assert staff_can('staff',   'item.86'),            'staff may 86 an item';
  assert not staff_can('staff',   'order.void'),     'staff may not void';
  assert not staff_can('staff',   'order.refund'),   'staff may not refund';
  assert not staff_can('staff',   'analytics.view'), 'staff may not read numbers';
  assert staff_can('manager', 'order.void'),         'manager may void';
  assert staff_can('manager', 'customer.contact'),   'manager may reveal contact';
  assert not staff_can('manager', 'staff.manage'),   'manager may not manage staff';
  assert staff_can('owner',   'staff.manage'),       'owner may manage staff';
  assert not staff_can('owner', 'nonsense.action'),  'unknown action denies';

  -- staff_unlock --------------------------------------------------------------
  v_result := staff_unlock(v_barista, '9999');
  assert not (v_result ->> 'ok')::boolean, 'wrong PIN is refused';

  v_result := staff_unlock(v_barista, '2222');
  assert (v_result ->> 'ok')::boolean, 'right PIN is accepted';
  assert v_result ->> 'role' = 'staff', 'unlock returns the role';
  assert (select failed_pins from staff where id = v_barista) = 0,
    'a good PIN resets the counter';

  -- lockout -------------------------------------------------------------------
  for i in 1..5 loop
    perform staff_unlock(v_barista, '0000');
  end loop;

  select locked_until into v_locked from staff where id = v_barista;
  assert v_locked is not null and v_locked > now(), 'five misses lock the row';

  v_result := staff_unlock(v_barista, '2222');
  assert not (v_result ->> 'ok')::boolean, 'a locked row refuses a correct PIN';
  assert v_result ->> 'reason' = 'locked', 'and says why';

  -- lockouts are audited ------------------------------------------------------
  assert (select count(*) from staff_events
           where staff_id = v_barista and action = 'staff.locked') = 1,
    'the lockout wrote exactly one audit row';

  -- station constraint --------------------------------------------------------
  begin
    insert into staff (display_name, kind, pin_hash)
    values ('Bad Station', 'station', extensions.crypt('3333', extensions.gen_salt('bf', 4)));
    assert false, 'a station must not be allowed a PIN';
  exception when check_violation then
    null;
  end;

  -- a station can never unlock -------------------------------------------------
  declare
    v_station uuid;
  begin
    insert into staff (display_name, kind, role)
    values ('Test Station', 'station', 'staff')
    returning id into v_station;

    v_result := staff_unlock(v_station, '0000');
    assert not (v_result ->> 'ok')::boolean, 'a station cannot unlock';
    assert v_result ->> 'reason' = 'unknown', 'and is not even a candidate';
  end;

  -- claim_owner is self-closing -----------------------------------------------
  begin
    perform claim_owner('Second Owner');
    assert false, 'claim_owner must refuse once an owner exists';
  exception when others then
    null;
  end;

  raise notice 'staff.test.sql: all assertions passed';
end $$;

rollback;
