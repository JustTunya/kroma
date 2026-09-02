-- The receipt.
--
-- NOT a bon fiscal: that must come from certified fiscal hardware registered
-- with ANAF, and no web app can mint one. This is a commercial receipt — a
-- correct, itemised proof of purchase with a VAT breakdown, which is what the
-- customer wants and what the accountant reconciles against. The copy on the
-- page says so, and it must keep saying so.

alter table orders
  add column receipt_email   text check (receipt_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  -- Makes the send idempotent under a Stripe webhook retry.
  add column receipt_sent_at timestamptz;

-- order_receipt() reads discount_reason before Phase F exists to write it —
-- same forward-reference call as discount_total in the tender migration.
-- discount_total landed there; this is the one column left for the receipt
-- and the report to read a real value from the day Phase F ships.
alter table orders
  add column discount_reason text;

-- The same projection order_by_token() makes, plus everything a receipt needs.
-- One function rather than widening order_by_token(): the confirmation page
-- should not be shipping tax and tender to a screen that does not draw them.
create function order_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',              o.id,
    'day_number',      o.day_number,
    'order_number',    o.order_number,
    'status',          o.status,
    'customer_name',   o.customer_name,
    'placed_at',       o.placed_at,
    'payment_method',  o.payment_method,
    'settled_as',      o.settled_as,
    'subtotal',        o.subtotal,
    'discount_total',  o.discount_total,
    'discount_reason', o.discount_reason,
    'total',           o.total,
    'tax_total',       o.tax_total,
    'receipt_email',   o.receipt_email,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_name',          i.item_name,
               'quantity',           i.quantity,
               'selected_modifiers', i.selected_modifiers,
               'line_total',         i.line_total,
               'vat_rate',           i.vat_rate
             ) order by i.created_at, i.id)
        from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o
  where o.access_token = p_token;
$$;

-- The guest's own address, against their own order. The token is the credential,
-- exactly as it is for order_by_token() and cancel_order_by_token().
create function set_receipt_email(p_token uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update orders set receipt_email = nullif(btrim(lower(p_email)), '')
   where access_token = p_token
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

grant execute on function order_receipt(uuid) to anon, authenticated;
grant execute on function set_receipt_email(uuid, text) to anon, authenticated;
