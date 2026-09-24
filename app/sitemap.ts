import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// ponytail: two public routes, hand-listed. Add menu/item URLs here if items get their own pages.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date("2026-09-01"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
