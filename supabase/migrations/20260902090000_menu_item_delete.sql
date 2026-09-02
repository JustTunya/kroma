-- Removing an item entirely, not just taking it off the menu (is_active).
-- order_items.menu_item_id is "on delete set null" so past orders keep their
-- name/price snapshot; favourites cascade away. Same gate as menu_upsert.
create function menu_item_delete(p_actor uuid, p_id uuid)
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

  delete from menu_items where id = p_id returning * into v_item;
  if v_item.id is null then
    raise exception 'No such item.' using errcode = 'P0001';
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.delete', v_item.id, jsonb_build_object('name', v_item.name));
end;
$$;

revoke all on function menu_item_delete(uuid, uuid) from public, anon;
grant execute on function menu_item_delete(uuid, uuid) to authenticated;
