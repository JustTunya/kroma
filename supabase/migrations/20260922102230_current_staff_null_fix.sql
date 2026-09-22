-- current_staff() was declared `returns staff` (a single composite, not
-- SETOF). Postgres treats a non-SETOF function call in a FROM clause as
-- exactly one row even when the function's own SELECT matched nothing —
-- the composite value is NULL, but expanding NULL::staff.* still yields one
-- row of all-null columns. PostgREST's RPC wrapping does exactly that
-- expansion, so `.rpc("current_staff").maybeSingle()` got back a non-null
-- object with every field null for ANY authenticated non-staff visitor —
-- truthy in JS, so `{staff && <Dashboard link>}` (app/account/layout.tsx)
-- showed the staff dashboard link to every signed-in customer. The
-- `/dashboard` middleware gate queries the `staff` table directly (not
-- through this function) and isn't affected — hence the link appearing but
-- leading nowhere.
--
-- Fix: SETOF + limit 1. A SETOF function naturally returns zero rows when
-- its query matches nothing, so PostgREST returns `[]` and
-- `.maybeSingle()` correctly resolves to `null`.
--
-- While rebuilding it: also stop returning pin_hash. current_staff() is
-- security definer, so it bypasses both RLS and the table-level grant that
-- already excludes pin_hash for direct table reads (see the demo-staff-mode
-- migration's pin_hash lockdown) — a signed-in staff member's own bcrypt
-- hash was still going out over this RPC. No caller (lib/staff.ts) reads it.
drop function if exists current_staff();

create function current_staff()
returns table (
  id           uuid,
  user_id      uuid,
  kind         text,
  display_name text,
  role         staff_role,
  station      text,
  failed_pins  smallint,
  locked_until timestamptz,
  is_active    boolean,
  created_at   timestamptz,
  updated_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.user_id, s.kind, s.display_name, s.role, s.station,
         s.failed_pins, s.locked_until, s.is_active, s.created_at, s.updated_at
  from staff s
  where s.user_id = auth.uid() and s.is_active
  limit 1;
$$;

revoke all on function current_staff() from public, anon;
grant execute on function current_staff() to authenticated;
