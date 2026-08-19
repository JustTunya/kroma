-- Pay first, then the order exists.
--
-- An online order is created only from a Stripe session that has already been
-- paid, so an unpaid card order never reaches the orders table at all. The
-- pricing loop create_order used to own is lifted into order_lines() so the
-- pre-payment quote and the post-payment insert cannot disagree about money.
--
-- Consequence, deliberately accepted: an online order no longer holds stock
-- while the customer is at Stripe. quote_order() refuses an item that is
-- already gone, but two people can still pay for the last bun — the loser's
-- create_order raises and the caller refunds them.

-- ------------------------------------------------------------ line resolver
-- The single authority on what a line costs. The client sends item ids,
-- quantities and modifier NAMES; every number here is read from menu_items.
--
-- p_lock takes `for update` on each menu row: true when the caller is about to
-- decrement stock (it serializes two people reaching for the last bun), false
-- for a read-only quote.
create function order_lines(p_items jsonb, p_lock boolean)
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

    -- `for update` is the whole concurrency story: it serializes two people
    -- reaching for the last bun. A quote takes no lock — it writes nothing.
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

    -- Exactly one selection per group on the item, no extras. ModifierSheet
    -- models selection as one option per group, so counts must match.
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

      -- priceOffset comes from THIS row, never from what the client sent.
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

    -- null daily_stock = unlimited (espresso bar). An integer is a batch.
    -- Checked in both modes: a quote must not send someone to Stripe for a
    -- tray that is already gone.
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

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id',       v_item.id,
      'item_name',          v_item.name,
      'base_price',         v_item.base_price,
      'quantity',           v_qty,
      'selected_modifiers', v_resolved,
      'line_total',         v_unit * v_qty
    ));
  end loop;

  return v_lines;
end;
$$;

-- -------------------------------------------------------------------- quote
-- Prices a cart without touching it. Feeds the Stripe line items, so what the
-- card is charged and what the order stores come from the same code.
create function quote_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb := order_lines(p_items, false);
begin
  return jsonb_build_object(
    'lines',    v_lines,
    'subtotal', coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0)
  );
end;
$$;

-- ------------------------------------------------------------- create_order
-- Replaced: the 4-argument version was always called by the customer, before
-- paying. Online orders are now inserted after the money lands, by the service
-- role, so it also takes the owner and the Stripe ids.
drop function create_order(jsonb, text, text, text);

create function create_order(
  p_items                    jsonb,
  p_customer_name            text,
  p_notes                    text,
  p_payment_method           text,
  p_user_id                  uuid default null,
  p_stripe_session_id        text default null,
  p_stripe_payment_intent_id text default null
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
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
  end if;

  -- Only the service role — the Stripe webhook and the confirmation page — may
  -- name the owner, and it is the only caller allowed to write a card order at
  -- all. A customer's session gets its own auth.uid() and nothing else, so a
  -- guest can neither hang an order on somebody else's account nor mint a paid
  -- one without paying.
  -- nullif before the cast: an unset or blank claim must read as "not the
  -- service role", not raise on an empty jsonb.
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
     = 'service_role' then
    v_user := p_user_id;
  elsif p_payment_method = 'online' then
    raise exception 'Card orders are placed once the payment clears.'
      using errcode = 'P0001';
  else
    v_user := auth.uid();
  end if;

  v_lines    := order_lines(p_items, true);
  v_subtotal := coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0);

  -- Aggregated: an item appearing on two lines must be decremented for both.
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

  -- 'paid' for online: it cannot reach this line otherwise. expires_at stays
  -- null — nothing is held, because nothing exists before the money does.
  -- The unique index on stripe_session_id is the idempotency: the webhook and
  -- the confirmation page both try, and the second one gets 23505.
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
                           quantity, selected_modifiers, line_total)
  select v_order.id,
         (l ->> 'menu_item_id')::uuid,
         l ->> 'item_name',
         (l ->> 'base_price')::numeric,
         (l ->> 'quantity')::smallint,
         l -> 'selected_modifiers',
         (l ->> 'line_total')::numeric
    from jsonb_array_elements(v_lines) as t(l);

  return v_order;
end;
$$;

revoke all on function order_lines(jsonb, boolean) from public, anon, authenticated;
revoke all on function quote_order(jsonb) from public;
revoke all on function create_order(jsonb, text, text, text, uuid, text, text) from public;
grant execute on function quote_order(jsonb) to anon, authenticated;
grant execute on function create_order(jsonb, text, text, text, uuid, text, text)
  to anon, authenticated, service_role;
