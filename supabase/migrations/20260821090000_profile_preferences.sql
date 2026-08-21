-- Settings needs two things profiles could not hold yet.
--
-- avoid_allergens is the negative half of a diet. dietary_tags already stores
-- the positive claims a customer wants (Vegan, Gluten-Free) and matches
-- menu_items.dietary_tags; this stores what must NOT be in the cup or on the
-- plate and matches menu_items.allergens. Two columns because the two match
-- rules are opposites: a diet tag has to be present on the item, an allergen
-- has to be absent.
--
-- bar_name is the name called out over the pass. display_name is who the
-- account belongs to and greets them on /account — plenty of people want
-- "Alexandra Popescu" on the account and "Alex" shouted across the room.

alter table profiles
  add column avoid_allergens text[] not null default '{}',
  add column bar_name        text;
