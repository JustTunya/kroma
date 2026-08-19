-- Earning and burning, threaded through the functions that already own money.
--
-- The discount arithmetic goes in order_lines() and nowhere else. quote_order
-- prices the Stripe session and create_order writes the order; both call
-- order_lines, so putting it there is what stops the card being charged one
-- number and the order storing another.
--
-- create_order keeps the authorisation — the lock and the balance check —
-- because it is the only one of the two that writes.

-- Old signatures go first: adding a defaulted argument to an existing function
-- creates an overload, and an ambiguous call is worse than a missing one.
drop function create_order(jsonb, text, text, text, uuid, text, text);
drop function quote_order(jsonb);
drop function order_lines(jsonb, boolean);

create function order_lines(p_items jsonb, p_lock boolean, p_redeem_item_id uuid default null)
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

    select mc.earns_punch into v_earns
      from menu_categories mc
     where mc.id = v_item.category_id;
    v_earns := coalesce(v_earns, false);

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

    -- One unit free, never the whole line. A line of three cortados with the
    -- card redeemed against it is one free cup and two paid ones.
    v_free := 0;
    if p_redeem_item_id is not null and v_item.id = p_redeem_item_id then
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

-- -------------------------------------------------------------------- quote
-- The card is checked HERE as well as in create_order. quote_order is granted
-- to authenticated, so without this a customer could name a redeem item with an
-- empty card and be sent to Stripe with a discounted session.
create function quote_order(p_items jsonb, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
begin
  if p_redeem_item_id is not null then
    if auth.uid() is null or card_punches(auth.uid()) < 12 then
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

-- ------------------------------------------------------------- create_order
create function create_order(
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
  v_order    orders;
  v_lines    jsonb;
  v_subtotal numeric(8,2);
  v_user     uuid;
  v_redeem   uuid := null;
  v_free     jsonb;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
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

  -- The burn. The advisory lock serializes this user's redemptions and releases
  -- with the transaction; create_order is already the serialization point for
  -- stock, so nothing new is being held open.
  if p_redeem_item_id is not null then
    if v_user is null then
      raise exception 'The card belongs to an account.' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_user::text));

    if card_punches(v_user) >= 12 then
      v_redeem := p_redeem_item_id;
    else
      -- ponytail: accepted loss. Two concurrent checkouts on one full card both
      -- reach here; the second finds it spent. We are holding their money, and
      -- refunding a whole paid order over one drink is worse than absorbing it,
      -- so the order stands at full price with no redemption row.
      raise warning 'card already spent for % — order placed undiscounted', v_user;
    end if;
  end if;

  v_lines    := order_lines(p_items, true, v_redeem);
  v_subtotal := coalesce((select sum((l ->> 'line_total')::numeric)
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

  insert into orders (user_id, status, customer_name, notes, subtotal, total,
                      payment_method, pickup_at, stripe_session_id,
                      stripe_payment_intent_id)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id)
  returning * into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, selected_modifiers, line_total, earns_punch)
  select v_order.id,
         (l ->> 'menu_item_id')::uuid,
         l ->> 'item_name',
         (l ->> 'base_price')::numeric,
         (l ->> 'quantity')::smallint,
         l -> 'selected_modifiers',
         (l ->> 'line_total')::numeric,
         (l ->> 'earns_punch')::boolean
    from jsonb_array_elements(v_lines) as t(l);

  if v_redeem is not null then
    select value into v_free
      from jsonb_array_elements(v_lines) as t(value)
     where (value ->> 'menu_item_id')::uuid = v_redeem;

    insert into card_redemptions (user_id, order_id, item_name)
    values (v_user, v_order.id, v_free ->> 'item_name');
  end if;

  return v_order;
end;
$$;

revoke all on function order_lines(jsonb, boolean, uuid) from public, anon, authenticated;
revoke all on function quote_order(jsonb, uuid) from public;
revoke all on function create_order(jsonb, text, text, text, uuid, text, text, uuid) from public;
grant execute on function quote_order(jsonb, uuid) to anon, authenticated;
grant execute on function create_order(jsonb, text, text, text, uuid, text, text, uuid)
  to anon, authenticated, service_role;
