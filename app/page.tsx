import { Storefront } from "@/components/storefront/Storefront";
import { menuImage } from "@/lib/menu-images";
import { createClient } from "@/lib/server";
import type { MenuItem } from "@/types/menu";
import seedMenu from "@/menu.json";

/** The menu is served fresh: batch stock moves through the morning. */
export const revalidate = 30;

type RawMenuItem = Omit<MenuItem, "image_url"> & { image_url: string | null };

async function fetchMenu(): Promise<RawMenuItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, name, description, base_price, daily_stock, dietary_tags, image_url, sort_order, menu_categories!inner (name, sort_order)",
    )
    .eq("is_active", true);

  if (error) console.error("menu_items fetch failed:", error.message);

  if (error || !data?.length) {
    // ponytail: repo-local menu.json keeps the storefront renderable before the
    // migration + seed are applied to the project. Drop once the DB is live.
    return seedMenu.map((item, index) => ({
      id: `seed-${index}`,
      name: item.name,
      description: item.description,
      base_price: item.basePrice,
      daily_stock: item.dailyStock,
      dietary_tags: item.dietaryTags,
      image_url: null,
      category: item.category,
      origin: item.origin,
      process: item.process,
      roast: item.roast,
    }));
  }

  return data
    .sort(
      (a, b) =>
        a.menu_categories.sort_order - b.menu_categories.sort_order ||
        a.sort_order - b.sort_order,
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      base_price: item.base_price,
      daily_stock: item.daily_stock,
      dietary_tags: item.dietary_tags,
      image_url: item.image_url,
      category: item.menu_categories.name,
      // ponytail: menu_items has no origin/process/roast columns yet, so rows
      // from the DB drop the spec line. Add the columns and select them here.
      origin: null,
      process: null,
      roast: null,
    }));
}

export default async function Home() {
  const items: MenuItem[] = (await fetchMenu()).map((item, index) => ({
    ...item,
    image_url: menuImage(item, index),
  }));

  return <Storefront items={items} />;
}
