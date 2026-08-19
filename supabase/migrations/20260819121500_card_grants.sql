-- Close the anon gap left by 20260819121000_card.sql.
--
-- `revoke ... from public` does not strip execute from `anon` here: Supabase's
-- schema-wide default ACL grants EXECUTE to anon/authenticated/service_role on
-- every new function at creation time, as a separate, already-materialized
-- grant. Revoking from `public` only removes the PUBLIC pseudo-role's grant;
-- it does nothing to that other grant. `card_punches(uuid)` got this right by
-- revoking from `public, anon, authenticated` explicitly -- match that here.
revoke all on function my_card()  from public, anon, authenticated;
revoke all on function my_usual() from public, anon, authenticated;
grant execute on function my_card()  to authenticated;
grant execute on function my_usual() to authenticated;
