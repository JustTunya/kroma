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

-- create_order() gains the guest's receipt address, last — Postgres requires
-- every defaulted parameter to follow every non-defaulted one, and every
-- earlier parameter here already has a default. Copied from
-- 20260901092000_tender_and_close.sql's create_order (the settled_as one),
-- with p_receipt_email threaded onto the insert.
create or replace function create_order(
  p_items                    jsonb,
  p_customer_name            text,
  p_notes                    text,
  p_payment_method           text,
  p_user_id                  uuid default null,
  p_stripe_session_id        text default null,
  p_stripe_payment_intent_id text default null,
  p_redeem_item_id           uuid default null,
  p_receipt_email            text default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order         orders;
  v_lines         jsonb;
  v_subtotal      numeric(8,2);
  v_tax           numeric(8,2);
  v_user          uuid;
  v_redeem        uuid := null;
  v_redeemed_line jsonb;
  v_day           date;
  v_number        integer;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
  end if;

  v_day := current_service_day();
  if v_day is null then
    raise exception 'The bakehouse is closed.' using errcode = 'P0001';
  end if;

  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
     = 'service_role' then
    v_user := p_user_id;
  elsif p_payment_method = 'online' then
    raise exception 'Card orders are placed once the payment clears.'
      using errcode = 'P0001';
  else
    v_user := auth.uid();
  end if;

  if p_redeem_item_id is not null then
    if v_user is null then
      raise exception 'The card belongs to an account.' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_user::text));

    if card_punches(v_user) >= 12 then
      v_redeem := p_redeem_item_id;
    else
      raise warning 'card already spent for % — order placed undiscounted', v_user;
    end if;
  end if;

  v_lines    := order_lines(p_items, true, v_redeem);
  v_subtotal := coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0);
  v_tax      := coalesce((select sum(vat_of((l ->> 'line_total')::numeric,
                                             (l ->> 'vat_rate')::numeric))
                            from jsonb_array_elements(v_lines) as t(l)), 0);

  update menu_items m
     set daily_stock = m.daily_stock - agg.qty
    from (
      select (l ->> 'menu_item_id')::uuid as id,
             sum((l ->> 'quantity')::integer) as qty
        from jsonb_array_elements(v_lines) as t(l)
       group by 1
    ) agg
   where m.id = agg.id
     and m.daily_stock is not null;

  update service_days
     set next_number = next_number + 1
   where day = v_day
  returning next_number - 1 into v_number;

  insert into orders (user_id, status, customer_name, notes, subtotal, total,
                      tax_total, settled_as, payment_method, pickup_at,
                      stripe_session_id, stripe_payment_intent_id,
                      service_day, day_number, receipt_email)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          v_tax,
          case when p_payment_method = 'online' then 'online' else null end,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id,
          v_day,
          v_number,
          nullif(btrim(lower(coalesce(p_receipt_email, ''))), ''))
  returning * into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, selected_modifiers, line_total, earns_punch,
                           vat_rate)
  select v_order.id,
         (l ->> 'menu_item_id')::uuid,
         l ->> 'item_name',
         (l ->> 'base_price')::numeric,
         (l ->> 'quantity')::smallint,
         l -> 'selected_modifiers',
         (l ->> 'line_total')::numeric,
         (l ->> 'earns_punch')::boolean,
         (l ->> 'vat_rate')::numeric
    from jsonb_array_elements(v_lines) as t(l);

  if v_redeem is not null then
    select value into v_redeemed_line
      from jsonb_array_elements(v_lines) as t(value)
     where (value ->> 'menu_item_id')::uuid = v_redeem;

    insert into card_redemptions (user_id, order_id, item_name)
    values (v_user, v_order.id, v_redeemed_line ->> 'item_name');
  end if;

  return v_order;
end;
$$;
