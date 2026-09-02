
import type { ModifierGroup } from "@/types/menu";

export type DraftItem = {
  id: string | null;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  dailyStock: number | null;
  parStock: number | null;
  dietaryTags: string[];
  allergens: string[];
  modifiers: ModifierGroup[];
  imageUrl: string | null;
  isActive: boolean;
};

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validModifiers(groups: ModifierGroup[]): boolean {
  if (!Array.isArray(groups)) return false;
  const groupNames = new Set(groups.map((g) => g.name));
  if (groupNames.size !== groups.length) return false;

  return groups.every((group) => {
    if (!group.name?.trim()) return false;
    if (!Array.isArray(group.options) || group.options.length === 0) return false;

    const optionNames = new Set(group.options.map((o) => o.name));
    if (optionNames.size !== group.options.length) return false;

    return group.options.every(
      (option) => Boolean(option.name?.trim()) && typeof option.priceOffset === "number",
    );
  });
}
