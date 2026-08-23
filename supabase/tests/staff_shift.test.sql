-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
--
-- The shift is derived from the last boundary row, so the only thing that can
-- really break is the derivation and the guard against writing a boundary
-- twice.
begin;

do $$
declare
  v_staff uuid;
  v_a     timestamptz;
  v_b     timestamptz;
begin
  insert into staff (display_name, role) values ('Shift Barista', 'staff')
  returning id into v_staff;

  assert staff_shift(v_staff) is null, 'a new person is not on shift';

  v_a := shift_mark(v_staff, true);
  assert v_a is not null, 'starting a shift returns when it started';
  assert staff_shift(v_staff) = v_a, 'and the shift reads back as open';

  -- Second iPad, same person.
  v_b := shift_mark(v_staff, true);
  assert v_b = v_a, 'starting an open shift is a no-op';
  assert (select count(*) from staff_events
           where staff_id = v_staff and action = 'shift.start') = 1,
    'and writes no second row';

  assert shift_mark(v_staff, false) is null, 'ending a shift closes it';
  assert staff_shift(v_staff) is null, 'and it reads back as closed';
  assert shift_mark(v_staff, false) is null, 'ending twice is a no-op';
  assert (select count(*) from staff_events
           where staff_id = v_staff and action = 'shift.end') = 1,
    'and writes no second row';

  -- Tomorrow.
  assert shift_mark(v_staff, true) is not null, 'a closed shift can reopen';

  raise notice 'staff_shift.test.sql: all assertions passed';
end $$;

rollback;
