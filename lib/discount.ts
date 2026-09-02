
export type DiscountKind = "percent" | "amount" | "comp";

export function previewDiscount(
  subtotal: number,
  kind: DiscountKind,
  value: number,
): { off: number; total: number } {
  const off = Math.round(
    (kind === "percent"
      ? (subtotal * Math.min(Math.max(value, 0), 100)) / 100
      : kind === "amount"
        ? Math.min(Math.max(value, 0), subtotal)
        : subtotal) * 100,
  ) / 100;

  return { off, total: Math.round((subtotal - off) * 100) / 100 };
}
