import type { BrewSpec, MenuItem } from "@/types/menu";

export type SensoryData = {
  tasting_notes: string[];
  elevation: string | null;
  harvest: string | null;
  brew_spec: BrewSpec | null;
};

export const MENU_SENSORY_DATA: Record<string, SensoryData> = {
  Espresso: {
    tasting_notes: ["Dark Chocolate", "Candied Orange", "Hazelnut"],
    elevation: "1,750m",
    harvest: "2025/2026 Lot",
    brew_spec: {
      temp: "93.5°C",
      ratio: "1:2 (18g in / 36g out)",
      notes: "9 bar extraction, 28s",
    },
  },
  "Flat White": {
    tasting_notes: ["Velveteen Cacao", "Toasted Macadamia", "Sweet Cream"],
    elevation: "1,750m",
    harvest: "2025/2026 Lot",
    brew_spec: {
      temp: "93.5°C",
      ratio: "Double ristretto + 60°C microfoam",
      notes: "Micro-textured whole milk or oat",
    },
  },
  Cappuccino: {
    tasting_notes: ["Malted Milk", "Almond Praline", "Baker's Cocoa"],
    elevation: "1,750m",
    harvest: "2025/2026 Lot",
    brew_spec: {
      temp: "93.5°C",
      ratio: "Double shot + 1:1 dense foam",
      notes: "Traditional thick aerated cap",
    },
  },
  "Iced Oat Cortado": {
    tasting_notes: ["Spiced Brown Sugar", "Roasted Oat", "Espresso Crema"],
    elevation: "1,750m",
    harvest: "2025/2026 Lot",
    brew_spec: {
      temp: "Chilled",
      ratio: "1:1 espresso to cold oat",
      notes: "Poured over rock ice",
    },
  },
  "Batch Brew Filter": {
    tasting_notes: ["Blackcurrant", "Bergamot", "Red Grapefruit"],
    elevation: "1,900m",
    harvest: "2025/2026 Crop",
    brew_spec: {
      temp: "94.0°C",
      ratio: "1:16.5 (60g/L)",
      notes: "Washed process, double bloom",
    },
  },
  "Cold Drip Reserve": {
    tasting_notes: ["Black Cherry", "Cacao Nibs", "Whiskey Barrel"],
    elevation: "1,850m",
    harvest: "2025 Reserve",
    brew_spec: {
      temp: "4°C slow drip",
      ratio: "1 drop every 1.5s",
      notes: "14-hour single-origin extraction",
    },
  },
  "Ceremonial Matcha Latte": {
    tasting_notes: ["Sweet Umami", "Young Bamboo", "Stone-Ground Pistachio"],
    elevation: "350m (Kyoto)",
    harvest: "1st Spring Harvest",
    brew_spec: {
      temp: "80°C",
      ratio: "2.5g matcha / 30ml water",
      notes: "Chasen whisked, steamed milk",
    },
  },
  "Sencha Steep": {
    tasting_notes: ["Steamed Greens", "Nori", "Spring Dew"],
    elevation: "600m",
    harvest: "Spring 2025",
    brew_spec: {
      temp: "78°C",
      ratio: "1:50, 2 min steep",
      notes: "Loose leaf, first infusion",
    },
  },
  "Bergamot Earl Grey": {
    tasting_notes: ["Calabrian Citrus", "Rich Malt", "Wild Lavender"],
    elevation: "1,200m",
    harvest: "2025 Crop",
    brew_spec: {
      temp: "95°C",
      ratio: "4 min steep",
      notes: "Ceylon OP with cold-pressed bergamot",
    },
  },
  "Peppermint Tisane": {
    tasting_notes: ["Crisp Menthol", "Crushed Pine", "Sweet Eucalyptus"],
    elevation: "Rift Valley",
    harvest: "Estate Dried",
    brew_spec: {
      temp: "98°C",
      ratio: "5 min steep",
      notes: "Whole dried peppermint leaf, caffeine-free",
    },
  },
  "Whole-Spice Chai": {
    tasting_notes: ["Wild Cardamom", "Cracked Pepper", "Cinnamon Bark"],
    elevation: "Assam Lowlands",
    harvest: "Monsoon 2025",
    brew_spec: {
      temp: "95°C slow decoction",
      ratio: "Fresh crushed spice in whole milk",
      notes: "Simmered 15m",
    },
  },
  "Cardamom Sugar Bun": {
    tasting_notes: ["Green Cardamom", "Pearl Sugar Crust", "Fermented Butter"],
    elevation: "Micro-Bakehouse",
    harvest: "Daily Dawn Bake",
    brew_spec: {
      temp: "Room / Warmed",
      ratio: "18h cold retard",
      notes: "Swedish knotted dough, 4°C overnight",
    },
  },
  "Twice-Baked Almond Croissant": {
    tasting_notes: [
      "Toasted Marcona Almond",
      "Bourbon Frangipane",
      "Flaky Caramelized Crust",
    ],
    elevation: "Micro-Bakehouse",
    harvest: "Daily Dawn Bake",
    brew_spec: {
      temp: "Room / Warmed",
      ratio: "72h laminated sourdough",
      notes: "French butter, twice-baked",
    },
  },
  "Spiced Banana Bread": {
    tasting_notes: [
      "Caramelized Banana",
      "Ceylon Cinnamon",
      "Roasted Walnut",
    ],
    elevation: "Micro-Bakehouse",
    harvest: "Daily Dawn Bake",
    brew_spec: {
      temp: "Room / Warmed",
      ratio: "Vegan olive oil crumb",
      notes: "Baked 06:00",
    },
  },
  "Whipped Ricotta & Fig Toast": {
    tasting_notes: [
      "Raw Hot Honey",
      "Mission Black Fig",
      "Cultured Ricotta & Sea Salt",
    ],
    elevation: "Kitchen Pass",
    harvest: "Fresh Prep",
    brew_spec: {
      temp: "Warm toast / Cool ricotta",
      ratio: "Thick cut country sourdough",
      notes: "Drizzled with chili-infused raw honey",
    },
  },
  "Mortadella & Pistachio Focaccia": {
    tasting_notes: [
      "Bologna Mortadella",
      "Creamy Stracciatella",
      "Bronte Pistachio Crumble",
    ],
    elevation: "Kitchen Pass",
    harvest: "Fresh Prep",
    brew_spec: {
      temp: "Toasted / Fresh",
      ratio: "24h high-hydration focaccia",
      notes: "Extra virgin olive oil emulsion",
    },
  },
  "Smoked Salmon & Dill Bagel": {
    tasting_notes: [
      "Cold-Smoked King Salmon",
      "Chive Cream Cheese",
      "Caperberry & Fresh Dill",
    ],
    elevation: "Kitchen Pass",
    harvest: "Fresh Prep",
    brew_spec: {
      temp: "Toasted bagel",
      ratio: "Boiled & sesame crusted",
      notes: "Wild cured salmon",
    },
  },
};

const DEFAULT_SENSORY: SensoryData = {
  tasting_notes: ["Artisanal Selection", "Balanced Profile", "Seasonal"],
  elevation: null,
  harvest: "Current Season",
  brew_spec: {
    temp: "Optimal Service",
    ratio: "Craft Standard",
    notes: "Artisanal preparation",
  },
};

export function getSensoryData(name?: string): SensoryData {
  if (name && MENU_SENSORY_DATA[name]) {
    return MENU_SENSORY_DATA[name];
  }
  return DEFAULT_SENSORY;
}

export function enrichMenuItem<T extends { name?: string; tasting_notes?: string[]; elevation?: string | null; harvest?: string | null; brew_spec?: BrewSpec | null }>(
  item: T,
): T & SensoryData {
  const sensory = getSensoryData(item.name);
  return {
    ...item,
    tasting_notes: item.tasting_notes ?? sensory.tasting_notes,
    elevation: item.elevation !== undefined ? item.elevation : sensory.elevation,
    harvest: item.harvest !== undefined ? item.harvest : sensory.harvest,
    brew_spec: item.brew_spec !== undefined ? item.brew_spec : sensory.brew_spec,
  };
}
