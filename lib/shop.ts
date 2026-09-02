/**
 * The shop's own details, for the receipt. Literal, from CLAUDE.md §1 — one
 * shop, one address, one set of hours.
 *
 * ponytail: hardcoded. If a second shop ever opens, this becomes a
 * shop_settings row read behind shop.settings, not a bigger constant.
 */
export const SHOP = {
  name: "KROMA Coffee & Bakehouse",
  address: "Str. Universității 12, Cluj-Napoca, Romania",
  hours: "Mon-Fri 07:30-18:00 | Sat-Sun 08:30-17:00",
  vatId: process.env.NEXT_PUBLIC_SHOP_VAT_ID ?? "RO00000000",
} as const;
