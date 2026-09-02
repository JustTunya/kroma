
export const SHOP = {
  name: "KROMA Coffee & Bakehouse",
  address: "Str. Universității 12, Cluj-Napoca, Romania",
  hours: "Mon-Fri 07:30-18:00 | Sat-Sun 08:30-17:00",
  vatId: process.env.NEXT_PUBLIC_SHOP_VAT_ID ?? "RO00000000",
} as const;
