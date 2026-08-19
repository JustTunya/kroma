-- The single authority on what an order costs and whether it can be made.
-- Everything below is one transaction: it all lands, or none of it does.
--
-- The client sends item ids, quantities, and modifier NAMES. It never sends a
-- price. Every number here is read from menu_items.

create function create_order(
  p_items          jsonb,
  p_customer_name  text,
  p_notes          text,
  p_payment_method text
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    orders;
  v_line     jsonb;
  v_item     menu_items%rowtype;
  v_qty      integer;
  v_group    jsonb;
  v_selected jsonb;
  v_option   jsonb;
  v_offset   numeric(8,2);
  v_unit     numeric(8,2);
  v_subtotal numeric(8,2) := 0;
  v_resolved jsonb;
  v_lines    jsonb := '[]'::jsonb;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
  end if;

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
    -- reaching for the last bun.
    select * into v_item
      from menu_items
     where id = (v_line ->> 'menu_item_id')::uuid
       and is_active
     for update;

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
    if v_item.daily_stock is not null then
      if v_item.daily_stock < v_qty then
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

      update menu_items set daily_stock = daily_stock - v_qty where id = v_item.id;
    end if;

    v_unit     := v_item.base_price + v_offset;
    v_subtotal := v_subtotal + v_unit * v_qty;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id',       v_item.id,
      'item_name',          v_item.name,
      'base_price',         v_item.base_price,
      'quantity',           v_qty,
      'selected_modifiers', v_resolved,
      'line_total',         v_unit * v_qty
    ));
  end loop;

  insert into orders (user_id, status, customer_name, notes, subtotal, total,
                      payment_method, pickup_at, expires_at)
  values (auth.uid(),
          'pending',
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          p_payment_method,
          now() + interval '10 minutes',
          case when p_payment_method = 'online'
               then now() + interval '30 minutes' end)
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

revoke all on function create_order(jsonb, text, text, text) from public;
grant execute on function create_order(jsonb, text, text, text) to anon, authenticated;
