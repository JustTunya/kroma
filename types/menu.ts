import type { Database } from "@/types/supabase";

type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];

export type ModifierOption = { name: string; priceOffset: number };
export type ModifierGroup = { name: string; required?: boolean; options: ModifierOption[] };

export type BrewSpec = {
  temp: string;
  ratio: string;
  notes: string;
};

export type MenuItem = Pick<
  MenuItemRow,
  "id" | "name" | "description" | "base_price" | "daily_stock" | "dietary_tags"
> & {
  category: string;
  vat_rate: number;
  image_url: string;
  origin: string | null;
  process: string | null;
  roast: string | null;
  modifiers: ModifierGroup[];
  tasting_notes?: string[];
  elevation?: string | null;
  harvest?: string | null;
  brew_spec?: BrewSpec | null;
};
