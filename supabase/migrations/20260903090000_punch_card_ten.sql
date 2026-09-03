-- Punch card shrinks from twelve cups to ten. The signup bonus (2, baked into
-- card_punches()) is untouched — a new customer still starts two in, they now
-- just need eight more instead of ten. Every "12" that meant "the card is
-- full" moves to "10"; nothing else about the formula changes.

alter table card_redemptions alter column punches_spent set default 10;

create or replace function my_card()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null
      then jsonb_build_object('punches', 0, 'ready', false, 'redeemed_count', 0)
    else jsonb_build_object(
      'punches',        card_punches(auth.uid()),
      'ready',          card_punches(auth.uid()) >= 10,
      'redeemed_count', (select count(*) from card_redemptions where user_id = auth.uid())
    )
  end;
$$;

-- Copied whole from 20260901090000_service_day.sql — only the threshold moves.
create or replace function quote_order(p_items jsonb, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
begin
  if current_service_day() is null then
    raise exception 'The bakehouse is closed.' using errcode = 'P0001';
  end if;

  if p_redeem_item_id is not null then
    if auth.uid() is null or card_punches(auth.uid()) < 10 then
      raise exception 'Your card is not full yet.' using errcode = 'P0001';
    end if;
  end if;

  v_lines := order_lines(p_items, false, p_redeem_item_id);

  return jsonb_build_object(
    'lines',    v_lines,
    'subtotal', coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0)
  );
end;
$$;

-- Copied whole from 20260901094000_receipts.sql — only the threshold moves.
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

    if card_punches(v_user) >= 10 then
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
