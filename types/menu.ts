import type { Database } from "@/types/supabase";

type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];

/**
 * A storefront-facing menu item: the row fields the UI needs, its category name,
 * and a photo already resolved on the server (row `image_url`, else fallback).
 */
export type MenuItem = Pick<
  MenuItemRow,
  "id" | "name" | "description" | "base_price" | "daily_stock" | "dietary_tags"
> & {
  category: string;
  image_url: string;
  /** Farm, region or counter the item comes from. */
  origin: string | null;
  /** How it is made: washed, laminated, cold-smoked. */
  process: string | null;
  /** Roast level. Coffee only — null everywhere else. */
  roast: string | null;
};
