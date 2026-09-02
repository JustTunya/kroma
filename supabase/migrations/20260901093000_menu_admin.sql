-- Editing the menu without a deploy.
--
-- menu.edit has existed in staff_can() since the dashboard shipped with nothing
-- behind it: changing a price has meant writing a migration. These three
-- functions are that surface, and they are the only writers — menu_items has no
-- insert or update policy and is not getting one.

-- The exact shape order_lines() parses. A malformed group does not surface as a
-- bad edit; it surfaces three days later as every checkout raising "that
-- selection is not on the menu". Validated here rather than in a CHECK because
-- a constraint would have to be immutable and would fail retroactively on rows
-- the app has already written.
create function valid_modifiers(p_modifiers jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_modifiers) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p_modifiers) as g(v)
        where coalesce(btrim(g.v ->> 'name'), '') = ''
           or coalesce(jsonb_typeof(g.v -> 'options'), '') <> 'array'
           or jsonb_array_length(g.v -> 'options') = 0
           or exists (
                select 1 from jsonb_array_elements(g.v -> 'options') as o(v)
                 where coalesce(btrim(o.v ->> 'name'), '') = ''
                    or coalesce(jsonb_typeof(o.v -> 'priceOffset'), '') <> 'number')
           or (select count(distinct o.v ->> 'name')
                 from jsonb_array_elements(g.v -> 'options') as o(v))
              <> jsonb_array_length(g.v -> 'options'))
     and (select count(distinct g.v ->> 'name')
            from jsonb_array_elements(p_modifiers) as g(v))
         = jsonb_array_length(p_modifiers);
$$;

-- translate() rather than unaccent(): the extension is not installed and this
-- menu is Romanian and English. One expression, and it cannot fail at deploy.
create function menu_slug(p_name text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      translate(lower(p_name), 'ăâîșşțţ', 'aaissttt'),
      '[^a-z0-9]+', '-', 'g'),
    '-');
$$;

-- Insert or update by id. The diff is computed against the row as it stood
-- before the write, so the audit reads as "base_price 4.20 -> 4.50" rather
-- than as a full row dump nobody will read at 11pm.
create function menu_upsert(p_actor uuid, p_item jsonb)
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

  -- The diff: only columns that actually changed, old value and new value.
  -- v_before.id is null on a create, so every column reads as changed —
  -- exactly right, since a create has no "before" worth diffing against.
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

-- The order the storefront and the staff list both read. One statement, one
-- audit row naming the whole new order.
create function menu_reorder(p_actor uuid, p_ids uuid[])
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

-- Same pattern, over menu_categories. Categories are few enough that the
-- diff is not worth computing — the audit row carries the whole object.
create function menu_category_upsert(p_actor uuid, p_category jsonb)
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

revoke all on function menu_upsert(uuid, jsonb) from public, anon;
revoke all on function menu_reorder(uuid, uuid[]) from public, anon;
revoke all on function menu_category_upsert(uuid, jsonb) from public, anon;
grant execute on function menu_upsert(uuid, jsonb) to authenticated;
grant execute on function menu_reorder(uuid, uuid[]) to authenticated;
grant execute on function menu_category_upsert(uuid, jsonb) to authenticated;
