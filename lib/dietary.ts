/**
 * What a customer will not eat, checked against what the kitchen actually put
 * in the thing. Shared by /account/settings (where the preference is set) and
 * /checkout (where it is enforced), so the vocabulary can only be wrong once.
 *
 * Two lists, because the two rules are opposites:
 *   DIETS     — the item must CARRY the tag  (menu_items.dietary_tags)
 *   ALLERGENS — the item must NOT LIST it    (menu_items.allergens)
 *
 * Both vocabularies are the ones the menu is actually seeded with. Nothing
 * outside them is stored: unknown values are dropped on save, not rejected.
 */

export const DIETS = ["Vegan", "Vegetarian", "Pescatarian", "Gluten-Free"] as const;

export const ALLERGENS = ["Dairy", "Gluten", "Eggs", "Tree Nuts", "Fish", "Sesame"] as const;

export type Diet = (typeof DIETS)[number];
export type Allergen = (typeof ALLERGENS)[number];

/** What a customer told us in Settings. Empty arrays mean "no preference". */
export type DietaryPrefs = { diets: string[]; avoid: string[] };

/** The bits of a menu item that decide whether it is edible for someone. */
export type ItemDietary = { dietary_tags: string[]; allergens: string[] };

export type SelectedModifier = { group: string; option: string };

/**
 * A stricter diet satisfies a looser one — a vegan bun is also vegetarian, and
 * both are fine for a pescatarian. Gluten-Free is orthogonal and satisfies only
 * itself.
 */
const SATISFIES: Record<Diet, readonly string[]> = {
  Vegan: ["Vegan"],
  Vegetarian: ["Vegan", "Vegetarian"],
  Pescatarian: ["Vegan", "Vegetarian", "Pescatarian"],
  "Gluten-Free": ["Gluten-Free"],
};

/**
 * Modifier options that change what is in the cup. Swapping the milk on a flat
 * white is the single most common order in the shop, and flagging an oat latte
 * as "contains dairy" would train people to ignore the warning — so the swap
 * groups carry their effect here, keyed by the exact option name in
 * menu_items.modifiers.
 *
 * `grantsIf` guards the diet claims: oat milk makes a Vegetarian drink vegan,
 * but it does not make a bacon roll vegan.
 *
 * ponytail: a hand-kept table against option names in the seed. If modifiers
 * ever grow their own allergen/dietary columns, read those instead and delete
 * this — the shape of `Effect` is deliberately what those columns would be.
 */
type Effect = {
  clears?: readonly Allergen[];
  adds?: readonly Allergen[];
  grants?: readonly Diet[];
  grantsIf?: Diet;
};

const MODIFIER_EFFECTS: Record<string, Effect> = {
  "Oat Milk (Vegan)": { clears: ["Dairy"], grants: ["Vegan"], grantsIf: "Vegetarian" },
  "Coconut Milk (Vegan)": { clears: ["Dairy"], grants: ["Vegan"], grantsIf: "Vegetarian" },
  "Almond Milk (Contains Nuts)": {
    clears: ["Dairy"],
    adds: ["Tree Nuts"],
    grants: ["Vegan"],
    grantsIf: "Vegetarian",
  },
  "Gluten-Free Seeded Bread": { clears: ["Gluten"], grants: ["Gluten-Free"] },
  // Bagel Choice — the option is named for the swap, not the loaf.
  "Gluten-Free": { clears: ["Gluten"], grants: ["Gluten-Free"] },
  Sesame: { adds: ["Sesame"] },
};

/** The item as it was actually ordered, with the chosen modifiers applied. */
export function asOrdered(item: ItemDietary, modifiers: SelectedModifier[] = []): ItemDietary {
  const allergens = new Set(item.allergens);
  const tags = new Set(item.dietary_tags);

  for (const { option } of modifiers) {
    const effect = MODIFIER_EFFECTS[option];
    if (!effect) continue;

    for (const allergen of effect.clears ?? []) allergens.delete(allergen);
    for (const allergen of effect.adds ?? []) allergens.add(allergen);

    if (effect.grants && (!effect.grantsIf || tags.has(effect.grantsIf))) {
      for (const tag of effect.grants) tags.add(tag);
    }
  }

  return { dietary_tags: [...tags], allergens: [...allergens] };
}

/**
 * Why this item breaks these preferences, in the bakehouse's voice. An empty
 * array means it is fine. Allergens come first — they are the half that matters
 * at speed.
 */
export function conflicts(
  item: ItemDietary,
  prefs: DietaryPrefs,
  modifiers: SelectedModifier[] = [],
): string[] {
  const ordered = asOrdered(item, modifiers);
  const reasons: string[] = [];

  for (const allergen of ALLERGENS) {
    if (prefs.avoid.includes(allergen) && ordered.allergens.includes(allergen)) {
      reasons.push(`Contains ${allergen.toLowerCase()}`);
    }
  }

  for (const diet of DIETS) {
    if (!prefs.diets.includes(diet)) continue;
    const accepted = SATISFIES[diet];
    if (!ordered.dietary_tags.some((tag) => accepted.includes(tag))) {
      reasons.push(`Not ${diet.toLowerCase()}`);
    }
  }

  return reasons;
}

export function hasPrefs(prefs: DietaryPrefs): boolean {
  return prefs.diets.length > 0 || prefs.avoid.length > 0;
}

/**
 * The preferences read back as the line the pass would see:
 * `VEGAN / NO DAIRY / NO GLUTEN`. Used on Settings as live feedback and at
 * checkout as the reason the warning is showing at all.
 */
export function passLine(prefs: DietaryPrefs): string[] {
  return [
    ...DIETS.filter((diet) => prefs.diets.includes(diet)),
    ...ALLERGENS.filter((allergen) => prefs.avoid.includes(allergen)).map(
      (allergen) => `No ${allergen.toLowerCase()}`,
    ),
  ];
}
