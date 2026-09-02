
export const DIETS = ["Vegan", "Vegetarian", "Pescatarian", "Gluten-Free"] as const;

export const ALLERGENS = ["Dairy", "Gluten", "Eggs", "Tree Nuts", "Fish", "Sesame"] as const;

export type Diet = (typeof DIETS)[number];
export type Allergen = (typeof ALLERGENS)[number];

export type DietaryPrefs = { diets: string[]; avoid: string[] };

export type ItemDietary = { dietary_tags: string[]; allergens: string[] };

export type SelectedModifier = { group: string; option: string };

const SATISFIES: Record<Diet, readonly string[]> = {
  Vegan: ["Vegan"],
  Vegetarian: ["Vegan", "Vegetarian"],
  Pescatarian: ["Vegan", "Vegetarian", "Pescatarian"],
  "Gluten-Free": ["Gluten-Free"],
};

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

  "Gluten-Free": { clears: ["Gluten"], grants: ["Gluten-Free"] },
  Sesame: { adds: ["Sesame"] },
};

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

export function passLine(prefs: DietaryPrefs): string[] {
  return [
    ...DIETS.filter((diet) => prefs.diets.includes(diet)),
    ...ALLERGENS.filter((allergen) => prefs.avoid.includes(allergen)).map(
      (allergen) => `No ${allergen.toLowerCase()}`,
    ),
  ];
}
