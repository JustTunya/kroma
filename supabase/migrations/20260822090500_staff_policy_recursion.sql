-- Fix: infinite recursion detected in policy for relation "staff".
--
-- Every policy added in 20260822090000 tested membership with
-- `exists (select 1 from staff s where s.user_id = auth.uid())`. Inside the
-- policy ON staff that subquery re-triggers the same policy, and Postgres
-- refuses; the policies on orders, order_items and profiles then inherit the
-- same failure the moment they touch staff.
--
-- One security definer helper, used by all five policies. Security definer
-- runs as the owner, so the membership test itself is not subject to RLS and
-- the cycle is broken at the single point every caller goes through.

create function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff
     where user_id = auth.uid() and is_active
  );
$$;

/** The caller's role, or null if they do not work here. */
create function staff_role_now()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from staff where user_id = auth.uid() and is_active;
$$;

drop policy "staff read roster"          on staff;
drop policy "staff events read manager"  on staff_events;
drop policy "orders staff read"          on orders;
drop policy "order items staff read"     on order_items;
drop policy "profiles staff read"        on profiles;

create policy "staff read roster" on staff
  for select using (is_staff());

-- staff_events stays append-only: still no insert, update or delete policy.
create policy "staff events read manager" on staff_events
  for select using (
    coalesce(staff_can(staff_role_now(), 'analytics.view'), false)
  );

create policy "orders staff read" on orders
  for select using (is_staff());

create policy "order items staff read" on order_items
  for select using (is_staff());

create policy "profiles staff read" on profiles
  for select using (is_staff());

revoke all on function is_staff() from public, anon;
revoke all on function staff_role_now() from public, anon;
grant execute on function is_staff() to authenticated;
grant execute on function staff_role_now() to authenticated;
