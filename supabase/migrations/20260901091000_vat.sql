-- VAT, extracted rather than added.
--
-- subtotal and total have been the same number since the schema was written,
-- because nothing anywhere breaks tax out. A shop's books cannot be filed from
-- that. Romania since 1 Aug 2025: 21% standard, 11% reduced covering food,
-- non-alcoholic drinks and restaurant service. Everything KROMA sells today is
-- 11%; the column exists so alcohol can be 21% without another migration.
--
-- The rate hangs off the CATEGORY, not off eat-in vs takeaway: both are 11%
-- here, so a fulfilment column would change no number and is not added.
--
-- Displayed prices stay gross, as EU consumer law requires and as base_price
-- already is:  vat = gross - gross / (1 + rate).

alter table menu_categories
  add column vat_rate numeric(4,3) not null default 0.110
    check (vat_rate >= 0 and vat_rate < 1);

-- Snapshotted for the same reason item_name and base_price are: a rate change
-- in 2027 must not rewrite 2026's books.
alter table order_items
  add column vat_rate numeric(4,3) not null default 0.110;

alter table orders
  add column tax_total numeric(8,2) not null default 0 check (tax_total >= 0);

-- One helper, so the rounding rule lives in exactly one place.
create function vat_of(p_gross numeric, p_rate numeric)
returns numeric
language sql
immutable
as $$
  select round(p_gross - p_gross / (1 + p_rate), 2);
$$;

-- ------------------------------------------------------------------ backfill
-- A shop's books do not get to have a gap.
update order_items i
   set vat_rate = coalesce(c.vat_rate, 0.110)
  from menu_items m
  join menu_categories c on c.id = m.category_id
 where m.id = i.menu_item_id;

update orders o
   set tax_total = coalesce(agg.tax, 0)
  from (select order_id, sum(vat_of(line_total, vat_rate)) as tax
          from order_items group by order_id) agg
 where agg.order_id = o.id;

-- ------------------------------------------------------------------ order_lines
-- Copied verbatim from 20260819122500_card_redeem_one_unit.sql:15, with the
-- category's vat_rate picked up on the existing earns_punch lookup and
-- carried on the returned line.
create or replace function order_lines(p_items jsonb, p_lock boolean, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line     jsonb;
  v_item     menu_items%rowtype;
  v_qty      integer;
  v_group    jsonb;
  v_selected jsonb;
  v_option   jsonb;
  v_offset   numeric(8,2);
  v_unit     numeric(8,2);
  v_resolved jsonb;
  v_lines    jsonb := '[]'::jsonb;
  v_earns    boolean;
  v_vat      numeric(4,3);
  v_free     integer;
  v_redeemed boolean := false;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nothing on the pass in this order.' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many lines on one order.' using errcode = 'P0001';
  end if;

  -- Ordered by menu_item_id on purpose: two concurrent transactions taking
  -- row locks in a different order deadlock. Sorting removes that entirely.
  for v_line in
    select value from jsonb_array_elements(p_items) as t(value)
    order by (value ->> 'menu_item_id')
  loop
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantity out of range.' using errcode = 'P0001';
    end if;

    if p_lock then
      select * into v_item
        from menu_items
       where id = (v_line ->> 'menu_item_id')::uuid
         and is_active
       for update;
    else
      select * into v_item
        from menu_items
       where id = (v_line ->> 'menu_item_id')::uuid
         and is_active;
    end if;

    if not found then
      raise exception 'That item is no longer on the menu.' using errcode = 'P0001';
    end if;

    select mc.earns_punch, mc.vat_rate into v_earns, v_vat
      from menu_categories mc
     where mc.id = v_item.category_id;
    v_earns := coalesce(v_earns, false);
    v_vat   := coalesce(v_vat, 0.110);

    if jsonb_array_length(coalesce(v_line -> 'modifiers', '[]'::jsonb))
       <> jsonb_array_length(v_item.modifiers) then
      raise exception '% — that selection is not on the menu.', v_item.name
        using errcode = 'P0001',
              detail  = json_build_object('menu_item_id', v_item.id)::text;
    end if;

    v_offset   := 0;
    v_resolved := '[]'::jsonb;

    for v_group in select value from jsonb_array_elements(v_item.modifiers) as t(value)
    loop
      select value into v_selected
        from jsonb_array_elements(coalesce(v_line -> 'modifiers', '[]'::jsonb)) as t(value)
       where value ->> 'group' = v_group ->> 'name';

      if v_selected is null then
        raise exception '% — choose a %.', v_item.name, lower(v_group ->> 'name')
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;

      select value into v_option
        from jsonb_array_elements(v_group -> 'options') as t(value)
       where value ->> 'name' = v_selected ->> 'option';

      if v_option is null then
        raise exception '% — that option is not available.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;

      v_offset := v_offset + (v_option ->> 'priceOffset')::numeric;

      v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
        'group',       v_group ->> 'name',
        'option',      v_option ->> 'name',
        'priceOffset', (v_option ->> 'priceOffset')::numeric
      ));
    end loop;

    if v_item.daily_stock is not null and v_item.daily_stock < v_qty then
      if v_item.daily_stock = 0 then
        raise exception '% — gone for today.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      else
        raise exception '% — only % left.', v_item.name, v_item.daily_stock
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;
    end if;

    v_unit := v_item.base_price + v_offset;

    -- One unit free, off ONE line, once per order. v_redeemed in the guard is
    -- load-bearing: without it, every line whose item matches p_redeem_item_id
    -- gets its own free unit.
    v_free := 0;
    if p_redeem_item_id is not null and not v_redeemed and v_item.id = p_redeem_item_id then
      if not v_earns then
        raise exception '% — the card is for drinks.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;
      v_free     := 1;
      v_redeemed := true;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id',       v_item.id,
      'item_name',          v_item.name,
      'base_price',         v_item.base_price,
      'quantity',           v_qty,
      'selected_modifiers', v_resolved,
      'earns_punch',        v_earns,
      'vat_rate',           v_vat,
      'redeemed_units',     v_free,
      'line_total',         v_unit * (v_qty - v_free)
    ));
  end loop;

  if p_redeem_item_id is not null and not v_redeemed then
    raise exception 'That drink is not in this order.' using errcode = 'P0001';
  end if;

  return v_lines;
end;
$$;

-- ------------------------------------------------------------------ create_order
-- Copied from 20260901090000_service_day.sql:199, with tax summed from the
-- lines' vat_rate and written to orders.tax_total and order_items.vat_rate.
create or replace function create_order(
  p_items                    jsonb,
  p_customer_name            text,
  p_notes                    text,
  p_payment_method           text,
  p_user_id                  uuid default null,
  p_stripe_session_id        text default null,
  p_stripe_payment_intent_id text default null,
  p_redeem_item_id           uuid default null
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

  -- Before anything is priced or locked: an order with nowhere to land is not
  -- an order, and an online one would arrive with the money already taken.
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
      -- ponytail: accepted loss, unchanged from the card migration. Two
      -- concurrent checkouts on one full card both reach here; the second finds
      -- it spent and the order stands at full price.
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
                      tax_total, payment_method, pickup_at, stripe_session_id,
                      stripe_payment_intent_id, service_day, day_number)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          v_tax,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id,
          v_day,
          v_number)
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
