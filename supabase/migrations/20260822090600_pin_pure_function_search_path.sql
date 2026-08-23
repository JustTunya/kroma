-- Supabase's database linter flags both of these as
-- `function_search_path_mutable`.
--
-- Neither touches a table, so the exposure is small — but staff_can() is
-- called from inside RLS policies, which is exactly the place not to leave a
-- resolvable name up to the caller's search_path. Pinned to empty: they
-- reference nothing but their own arguments.
alter function staff_can(staff_role, text) set search_path = '';
alter function order_transition_action(order_status, order_status) set search_path = '';
