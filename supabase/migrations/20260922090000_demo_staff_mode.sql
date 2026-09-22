-- supabase/migrations/20260922090000_demo_staff_mode.sql
--
-- M2: a shared, published staff account safe to trash. is_demo marks it;
-- two things change because of it. First, five RPCs that already gate
-- 'menu.edit' or 'order.refund' refuse the demo actor outright — capping
-- abuse by disabling the two destructive actions rather than rate-limiting
-- them, since nothing else in this codebase throttles by request rate.
-- Second, reset_demo_day() clears *today's* orders and lockouts (not
-- history — pnpm seed:demo's backfill is meant to survive resets) so the
-- nightly cron can call it before it opens the shop.

alter table staff add column is_demo boolean not null default false;

-- ---------------------------------------------------------- abuse capping
-- Copied verbatim from 20260901092000_tender_and_close.sql:30-144, with one
-- guard inserted after the existing staff_can check.
create or replace function advance_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor    uuid,
  p_station  uuid default null,
  p_tender   text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_order  orders;
  v_action text;
  v_stamp  timestamptz;
  v_refund boolean := false;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'No such order.' using errcode = 'P0001';
  end if;

  v_action := order_transition_action(v_order.status, p_to);
  if v_action is null then
    raise exception 'Cannot move % to %.', v_order.status, p_to
      using errcode = 'P0001';
  end if;

  if v_action = 'order.undo' then
    v_stamp := case v_order.status
      when 'paid'      then v_order.placed_at
      when 'preparing' then v_order.started_at
      when 'ready'     then v_order.ready_at
      when 'collected' then v_order.collected_at
    end;

    if v_stamp is null or now() - v_stamp > interval '90 seconds' then
      v_action := 'order.undo_late';
    else
      v_action := 'order.advance';
    end if;
  end if;

  if v_action = 'order.abandon'
     and (v_order.ready_at is null
          or now() - v_order.ready_at < interval '30 minutes') then
    v_action := 'order.void';
  end if;

  if not staff_can(v_actor.role, v_action) then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  -- Demo cap: the shared sandbox account can advance/void/undo orders, but
  -- never refund one.
  if v_actor.is_demo and v_action = 'order.refund' then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if v_order.payment_method = 'counter' and v_order.status = 'pending' and p_to = 'paid' then
    if p_tender is null or p_tender not in ('cash', 'card') then
      raise exception 'Cash or card?' using errcode = 'P0001';
    end if;
  end if;

  if p_to = 'cancelled' then
    update menu_items m
       set daily_stock = m.daily_stock + agg.qty
      from (select menu_item_id, sum(quantity)::integer as qty
              from order_items
             where order_id = p_order_id and menu_item_id is not null
             group by menu_item_id) agg
     where m.id = agg.menu_item_id and m.daily_stock is not null;
  end if;

  if p_to in ('cancelled', 'refunded')
     and v_order.payment_method = 'online'
     and v_order.stripe_payment_intent_id is not null then
    v_refund := true;
  end if;

  update orders
     set status       = p_to,
         started_at   = case when p_to = 'preparing' then now()
                             when p_to in ('pending','paid') then null
                             else started_at end,
         ready_at     = case when p_to = 'ready' then now()
                             when p_to in ('pending','paid','preparing')
                               then null
                             else ready_at end,
         collected_at = case when p_to = 'collected' then now()
                             when p_to in ('pending','paid','preparing','ready')
                               then null
                             else collected_at end,
         claimed_by   = case when p_to = 'preparing' then p_actor
                             else claimed_by end,
         settled_as   = case
                          when p_to = 'paid' and v_order.payment_method = 'counter'
                            then p_tender
                          when p_to = 'pending' then null
                          else settled_as end
   where id = p_order_id;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, v_action, p_order_id,
          jsonb_build_object('from', v_order.status, 'to', p_to,
                             'total', v_order.total, 'tender', p_tender));

  return jsonb_build_object('id', p_order_id, 'status', p_to,
                            'refund_owed', v_refund);
end;
$$;

-- Copied verbatim from 20260901093000_menu_admin.sql:53-179, same guard.
create or replace function menu_upsert(p_actor uuid, p_item jsonb)
returns menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_id     uuid := nullif(p_item ->> 'id', '')::uuid;
  v_before menu_items;
  v_after  menu_items;
  v_slug   text;
  v_diff   jsonb := '{}'::jsonb;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_item ->> 'name'), '') = '' then
    raise exception 'A menu item needs a name.' using errcode = 'P0001';
  end if;
  if (p_item ->> 'base_price')::numeric < 0 then
    raise exception 'Price cannot be negative.' using errcode = 'P0001';
  end if;
  if not valid_modifiers(coalesce(p_item -> 'modifiers', '[]'::jsonb)) then
    raise exception 'That modifier group is not shaped right.' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(p_item ->> 'slug'), '');
  if v_slug is null then
    v_slug := menu_slug(p_item ->> 'name');
  end if;

  if v_id is not null then
    select * into v_before from menu_items where id = v_id;
    if v_before.id is null then
      raise exception 'No such item.' using errcode = 'P0001';
    end if;
  end if;

  update menu_items
     set category_id  = (p_item ->> 'category_id')::uuid,
         slug          = v_slug,
         name          = btrim(p_item ->> 'name'),
         description   = nullif(btrim(coalesce(p_item ->> 'description', '')), ''),
         base_price    = (p_item ->> 'base_price')::numeric,
         daily_stock   = case when p_item ? 'daily_stock'
                               then nullif(p_item ->> 'daily_stock', '')::integer
                               else daily_stock end,
         par_stock     = case when p_item ? 'par_stock'
                               then nullif(p_item ->> 'par_stock', '')::integer
                               else par_stock end,
         dietary_tags  = case when p_item ? 'dietary_tags'
                               then coalesce((select array_agg(value #>> '{}')
                                                from jsonb_array_elements(p_item -> 'dietary_tags')), '{}')
                               else dietary_tags end,
         allergens     = case when p_item ? 'allergens'
                               then coalesce((select array_agg(value #>> '{}')
                                                from jsonb_array_elements(p_item -> 'allergens')), '{}')
                               else allergens end,
         modifiers     = coalesce(p_item -> 'modifiers', '[]'::jsonb),
         image_url     = case when p_item ? 'image_url'
                               then nullif(p_item ->> 'image_url', '') else image_url end,
         is_active     = coalesce((p_item ->> 'is_active')::boolean, is_active),
         updated_at    = now()
   where id = v_id
  returning * into v_after;

  if not found then
    insert into menu_items (category_id, slug, name, description, base_price,
                            daily_stock, par_stock, dietary_tags, allergens,
                            modifiers, image_url, is_active)
    values ((p_item ->> 'category_id')::uuid,
            v_slug,
            btrim(p_item ->> 'name'),
            nullif(btrim(coalesce(p_item ->> 'description', '')), ''),
            (p_item ->> 'base_price')::numeric,
            nullif(p_item ->> 'daily_stock', '')::integer,
            nullif(p_item ->> 'par_stock', '')::integer,
            coalesce((select array_agg(value #>> '{}')
                        from jsonb_array_elements(coalesce(p_item -> 'dietary_tags', '[]'::jsonb))), '{}'),
            coalesce((select array_agg(value #>> '{}')
                        from jsonb_array_elements(coalesce(p_item -> 'allergens', '[]'::jsonb))), '{}'),
            coalesce(p_item -> 'modifiers', '[]'::jsonb),
            nullif(p_item ->> 'image_url', ''),
            coalesce((p_item ->> 'is_active')::boolean, true))
    returning * into v_after;
  end if;

  if v_before.name is distinct from v_after.name then
    v_diff := v_diff || jsonb_build_object('name', jsonb_build_object('from', v_before.name, 'to', v_after.name));
  end if;
  if v_before.base_price is distinct from v_after.base_price then
    v_diff := v_diff || jsonb_build_object('base_price', jsonb_build_object('from', v_before.base_price, 'to', v_after.base_price));
  end if;
  if v_before.category_id is distinct from v_after.category_id then
    v_diff := v_diff || jsonb_build_object('category_id', jsonb_build_object('from', v_before.category_id, 'to', v_after.category_id));
  end if;
  if v_before.daily_stock is distinct from v_after.daily_stock then
    v_diff := v_diff || jsonb_build_object('daily_stock', jsonb_build_object('from', v_before.daily_stock, 'to', v_after.daily_stock));
  end if;
  if v_before.par_stock is distinct from v_after.par_stock then
    v_diff := v_diff || jsonb_build_object('par_stock', jsonb_build_object('from', v_before.par_stock, 'to', v_after.par_stock));
  end if;
  if v_before.is_active is distinct from v_after.is_active then
    v_diff := v_diff || jsonb_build_object('is_active', jsonb_build_object('from', v_before.is_active, 'to', v_after.is_active));
  end if;
  if v_before.description is distinct from v_after.description then
    v_diff := v_diff || jsonb_build_object('description', jsonb_build_object('from', v_before.description, 'to', v_after.description));
  end if;
  if v_before.modifiers is distinct from v_after.modifiers then
    v_diff := v_diff || jsonb_build_object('modifiers', jsonb_build_object('from', v_before.modifiers, 'to', v_after.modifiers));
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.edit', v_after.id, v_diff);

  return v_after;
end;
$$;

-- Copied verbatim from 20260901093000_menu_admin.sql:183-212, same guard.
create or replace function menu_reorder(p_actor uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_count integer;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  update menu_items
     set sort_order = t.idx - 1
    from unnest(p_ids) with ordinality as t(id, idx)
   where menu_items.id = t.id;
  get diagnostics v_count = row_count;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.reorder', null, jsonb_build_object('ids', to_jsonb(p_ids)));

  return v_count;
end;
$$;

-- Copied verbatim from 20260901093000_menu_admin.sql:216-269, same guard.
create or replace function menu_category_upsert(p_actor uuid, p_category jsonb)
returns menu_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_id    uuid := nullif(p_category ->> 'id', '')::uuid;
  v_slug  text;
  v_after menu_categories;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_category ->> 'name'), '') = '' then
    raise exception 'A category needs a name.' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(p_category ->> 'slug'), '');
  if v_slug is null then
    v_slug := menu_slug(p_category ->> 'name');
  end if;

  update menu_categories
     set slug        = v_slug,
         name        = btrim(p_category ->> 'name'),
         vat_rate    = coalesce((p_category ->> 'vat_rate')::numeric, vat_rate),
         earns_punch = coalesce((p_category ->> 'earns_punch')::boolean, earns_punch),
         is_active   = coalesce((p_category ->> 'is_active')::boolean, is_active)
   where id = v_id
  returning * into v_after;

  if not found then
    insert into menu_categories (slug, name, vat_rate, earns_punch, is_active)
    values (v_slug,
            btrim(p_category ->> 'name'),
            coalesce((p_category ->> 'vat_rate')::numeric, 0.110),
            coalesce((p_category ->> 'earns_punch')::boolean, false),
            coalesce((p_category ->> 'is_active')::boolean, true))
    returning * into v_after;
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.category_edit', v_after.id, to_jsonb(v_after));

  return v_after;
end;
$$;

-- Copied verbatim from 20260902090000_menu_item_delete.sql, same guard.
create or replace function menu_item_delete(p_actor uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_item  menu_items;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  delete from menu_items where id = p_id returning * into v_item;
  if v_item.id is null then
    raise exception 'No such item.' using errcode = 'P0001';
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.delete', v_item.id, jsonb_build_object('name', v_item.name));
end;
$$;

-- --------------------------------------------------------------- nightly reset
-- Service-role only: called from the cron route, never from the client. Only
-- today's orders go — history from pnpm seed:demo (or a genuinely prior day)
-- stays, so the dashboard's close-of-day and "past orders" pages keep looking
-- lived-in across resets.
create function reset_demo_day()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone shop_tz())::date;
  v_demo  staff;
begin
  select * into v_demo from staff where is_demo limit 1;

  delete from orders where (placed_at at time zone shop_tz())::date = v_today;
  delete from service_days where day = v_today;

  if v_demo.id is not null then
    update staff
       set failed_pins = 0, locked_until = null
     where id = v_demo.id;

    insert into staff_events (staff_id, action, detail)
    values (v_demo.id, 'demo.reset', jsonb_build_object('day', v_today));
  end if;
end;
$$;

revoke all on function reset_demo_day() from public, anon, authenticated;
grant execute on function reset_demo_day() to service_role;

-- ----------------------------------------------------- demo staff bootstrap
-- What pnpm seed:demo calls once it has created (or found) the demo Auth
-- user, to link it to a staff row with a known PIN. Idempotent via
-- upsert on the unique user_id — safe to re-run to rotate the PIN.
create function admin_upsert_demo_staff(p_user_id uuid, p_pin text)
returns staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row staff;
begin
  insert into staff (user_id, display_name, role, kind, pin_hash, is_active, is_demo)
  values (p_user_id, 'Demo Owner', 'owner', 'person',
          extensions.crypt(p_pin, extensions.gen_salt('bf')), true, true)
  on conflict (user_id) do update
     set pin_hash     = excluded.pin_hash,
         is_active    = true,
         is_demo      = true,
         failed_pins  = 0,
         locked_until = null
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function admin_upsert_demo_staff(uuid, text) from public, anon, authenticated;
grant execute on function admin_upsert_demo_staff(uuid, text) to service_role;
