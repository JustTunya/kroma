export type CartLine = {
  id: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  selectedModifiers: { group: string; option: string; priceOffset: number }[];
  imageUrl: string;
  vatRate: number;
};

const STORAGE_KEY = "kroma-cart";

export function lineTotal(line: CartLine): number {
  const modifierTotal = line.selectedModifiers.reduce(
    (sum, modifier) => sum + modifier.priceOffset,
    0,
  );
  return (line.basePrice + modifierTotal) * line.quantity;
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

function sameSelection(a: CartLine, b: CartLine): boolean {
  if (a.menuItemId !== b.menuItemId) return false;
  if (a.selectedModifiers.length !== b.selectedModifiers.length) return false;
  return a.selectedModifiers.every(
    (modifier, index) =>
      b.selectedModifiers[index]?.group === modifier.group &&
      b.selectedModifiers[index]?.option === modifier.option,
  );
}

export function mergeCarts(a: CartLine[], b: CartLine[]): CartLine[] {
  const merged = a.map((line) => ({ ...line }));
  for (const line of b) {
    const existing = merged.find((candidate) => sameSelection(candidate, line));
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      merged.push({ ...line });
    }
  }
  return merged;
}

export function readGuestCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
