-- KROMA seed data — mirrors menu.json

insert into menu_categories (slug, name, sort_order) values
  ('espresso-bar',       'Espresso Bar',       1),
  ('filter-cold',        'Filter & Cold',      2),
  ('tea-alternatives',   'Tea & Alternatives', 3),
  ('bakehouse',          'Bakehouse',          4),
  ('kitchen',            'Kitchen',            5);

insert into menu_items
  (category_id, slug, name, description, base_price, daily_stock, dietary_tags, allergens, modifiers, unsplash_query, sort_order)
values
  ((select id from menu_categories where slug = 'espresso-bar'),
   'espresso', 'Espresso',
   'Double shot of our seasonal house blend.',
   2.50, null,
   '{Vegan,"Gluten-Free"}', '{}',
   '[{"name":"Bean Choice","options":[
       {"name":"House Blend (Brazil/Colombia)","priceOffset":0},
       {"name":"Single Origin (Ethiopia)","priceOffset":0.50}]}]'::jsonb,
   'espresso shot crema glass', 1),

  ((select id from menu_categories where slug = 'espresso-bar'),
   'flat-white', 'Flat White',
   'Double ristretto shot with textured microfoam.',
   4.20, null,
   '{Vegetarian,"Gluten-Free"}', '{Dairy}',
   '[{"name":"Milk Choice","options":[
       {"name":"Whole Milk (Default)","priceOffset":0},
       {"name":"Oat Milk (Vegan)","priceOffset":0.60},
       {"name":"Almond Milk (Contains Nuts)","priceOffset":0.60}]}]'::jsonb,
   'flat white latte art ceramic cup', 2),

  ((select id from menu_categories where slug = 'espresso-bar'),
   'iced-oat-cortado', 'Iced Oat Cortado',
   'Equal parts espresso and oat milk over ice.',
   4.50, null,
   '{Vegan,"Gluten-Free"}', '{}',
   '[{"name":"Ice Level","options":[
       {"name":"Regular Ice","priceOffset":0},
       {"name":"Light Ice","priceOffset":0}]},
     {"name":"Syrup","options":[
       {"name":"None","priceOffset":0},
       {"name":"Cardamom Vanilla","priceOffset":0.50}]}]'::jsonb,
   'iced cortado layered glass espresso', 3),

  ((select id from menu_categories where slug = 'filter-cold'),
   'batch-brew-filter', 'Batch Brew Filter',
   'Rotating single-origin filter coffee (Kenya AA Nyeri).',
   3.80, null,
   '{Vegan,"Gluten-Free"}', '{}',
   '[{"name":"Size","options":[
       {"name":"250ml","priceOffset":0},
       {"name":"350ml","priceOffset":0.80}]}]'::jsonb,
   'batch brew filter coffee glass server', 1),

  ((select id from menu_categories where slug = 'filter-cold'),
   'cold-drip-reserve', 'Cold Drip Reserve',
   'Slow-dripped for 14 hours. Served chilled.',
   5.20, 15,
   '{Vegan,"Gluten-Free"}', '{}',
   '[{"name":"Serving Style","options":[
       {"name":"Over Rock Ice","priceOffset":0},
       {"name":"Neat","priceOffset":0}]}]'::jsonb,
   'cold brew bottle glass ice cube', 2),

  ((select id from menu_categories where slug = 'tea-alternatives'),
   'ceremonial-matcha-latte', 'Ceremonial Matcha Latte',
   'First-harvest Uji matcha whisked with steamed milk.',
   5.00, null,
   '{Vegetarian,"Gluten-Free"}', '{Dairy}',
   '[{"name":"Milk Choice","options":[
       {"name":"Whole Milk","priceOffset":0},
       {"name":"Oat Milk (Vegan)","priceOffset":0.60},
       {"name":"Coconut Milk (Vegan)","priceOffset":0.60}]},
     {"name":"Sweetness","options":[
       {"name":"Unsweetened","priceOffset":0},
       {"name":"Agave Syrup","priceOffset":0.40}]}]'::jsonb,
   'matcha latte green foam ceramic cup', 1),

  ((select id from menu_categories where slug = 'bakehouse'),
   'cardamom-sugar-bun', 'Cardamom Sugar Bun',
   'Traditional Swedish knot pastry with freshly ground cardamom.',
   3.90, 12,
   '{Vegetarian}', '{Gluten,Dairy,Eggs}',
   '[{"name":"Serving","options":[
       {"name":"Room Temperature","priceOffset":0},
       {"name":"Warmed","priceOffset":0}]}]'::jsonb,
   'cardamom bun swedish pastry bakery', 1),

  ((select id from menu_categories where slug = 'bakehouse'),
   'twice-baked-almond-croissant', 'Twice-Baked Almond Croissant',
   'Sourdough croissant filled with frangipane and topped with toasted almonds.',
   4.50, 8,
   '{Vegetarian}', '{Gluten,Dairy,Eggs,"Tree Nuts"}',
   '[{"name":"Serving","options":[
       {"name":"Room Temperature","priceOffset":0},
       {"name":"Warmed","priceOffset":0}]}]'::jsonb,
   'twice baked almond croissant powdered sugar', 2),

  ((select id from menu_categories where slug = 'bakehouse'),
   'spiced-banana-bread', 'Spiced Banana Bread',
   'Thick slice of banana bread with walnuts and cinnamon.',
   4.00, 10,
   '{Vegan}', '{Gluten,"Tree Nuts"}',
   '[{"name":"Add-ons","options":[
       {"name":"None","priceOffset":0},
       {"name":"Vegan Butter","priceOffset":0.50}]}]'::jsonb,
   'banana bread slice walnuts', 3),

  ((select id from menu_categories where slug = 'kitchen'),
   'whipped-ricotta-fig-toast', 'Whipped Ricotta & Fig Toast',
   'Fresh ricotta, black figs, hot honey, and sea salt on thick sourdough.',
   7.80, 15,
   '{Vegetarian}', '{Gluten,Dairy}',
   '[{"name":"Bread Choice","options":[
       {"name":"Country Sourdough","priceOffset":0},
       {"name":"Gluten-Free Seeded Bread","priceOffset":1.00}]}]'::jsonb,
   'ricotta toast figs honey sourdough', 1),

  ((select id from menu_categories where slug = 'kitchen'),
   'mortadella-pistachio-focaccia', 'Mortadella & Pistachio Focaccia',
   'House-baked focaccia loaded with mortadella, stracciatella, and crushed pistachios.',
   8.50, 10,
   '{}', '{Gluten,Dairy,"Tree Nuts"}',
   '[{"name":"Preparation","options":[
       {"name":"Toasted","priceOffset":0},
       {"name":"Fresh","priceOffset":0}]}]'::jsonb,
   'mortadella focaccia sandwich stracciatella', 2),

  ((select id from menu_categories where slug = 'kitchen'),
   'smoked-salmon-dill-bagel', 'Smoked Salmon & Dill Bagel',
   'Cold-smoked salmon, chive cream cheese, capers, and dill on a toasted sesame bagel.',
   9.20, 12,
   '{Pescatarian}', '{Gluten,Dairy,Fish,Sesame}',
   '[{"name":"Bagel Choice","options":[
       {"name":"Sesame","priceOffset":0},
       {"name":"Everything","priceOffset":0},
       {"name":"Gluten-Free","priceOffset":1.50}]}]'::jsonb,
   'smoked salmon bagel cream cheese dill', 3);
