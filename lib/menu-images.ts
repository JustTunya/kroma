
const UNSPLASH = "https://images.unsplash.com/photo-";

const POOL: Record<string, string[]> = {
  "Espresso Bar": [
    "1497935586351-b67a49e012bf",
    "1509042239860-f550ce710b93",
    "1541167760496-1628856ab772",
    "1572442388796-11668a67e53d",
  ],
  "Filter & Cold": [
    "1442512595331-e89e73853f31",
    "1592663527359-cf6642f54cff",
    "1559496417-e7f25cb247f3",
  ],
  "Tea & Alternatives": ["1564890369478-c89ca6d9cde9", "1622480916113-9000ac49b79d"],
  Bakehouse: [
    "1555507036-ab1f4038808a",
    "1534432182912-63863115e106",
    "1509440159596-0249088772ff",
    "1517433670267-08bbd4be890f",
  ],
  Kitchen: [
    "1521305916504-4a1121188589",
    "1525351484163-7529414344d8",
    "1484723091739-30a097e8f929",
  ],
};

const DEFAULT_POOL = ["1495474472287-4d71bcdd2085"];

const CUSTOM: Record<string, string> = {
  Espresso: "/menu/coffee@espresso.png",
  Cappuccino: "/menu/coffee@cappuccino.png",
  "Flat White": "/menu/coffee@flat_white.png",
  "Iced Oat Cortado": "/menu/coffee@iced_oat_cortado.png",
  "Batch Brew Filter": "/menu/coffee@batch_brew_filter.png",
  "Cold Drip Reserve": "/menu/coffee@cold_drip_reserve.png",
  "Ceremonial Matcha Latte": "/menu/alter@ceremonial_matcha_latte.png",
  "Sencha Steep": "/menu/tea@green.png",
  "Bergamot Earl Grey": "/menu/tea@black.png",
  "Peppermint Tisane": "/menu/tea@herbal.png",
  "Whole-Spice Chai": "/menu/tea@spiced.png",
  "Cardamom Sugar Bun": "/menu/bake@cardamom_sugar_bun.png",
  "Twice-Baked Almond Croissant": "/menu/bake@twice_baked_almond_croissant.png",
  "Spiced Banana Bread": "/menu/bake@spiced_banana_bread.png",
  "Whipped Ricotta & Fig Toast": "/menu/food@whipped_ricotta_fig_toast.png",
  "Mortadella & Pistachio Focaccia": "/menu/food@mortadella_pistachio_focaccia.png",
  "Smoked Salmon & Dill Bagel": "/menu/food@smoked_salmon_dill_bagel.png",
};

export const HERO_IMAGE = `${UNSPLASH}1495474472287-4d71bcdd2085?w=1600&q=80&auto=format&fit=crop`;

export function menuImage(
  item: { name?: string; category: string; image_url: string | null },
  index: number,
): string {
  if (item.name && CUSTOM[item.name]) return CUSTOM[item.name];
  if (item.image_url) return item.image_url;

  const pool = POOL[item.category] ?? DEFAULT_POOL;

  return `${UNSPLASH}${pool[index % pool.length]}?w=800&q=80&auto=format&fit=crop`;
}
