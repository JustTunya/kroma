import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/account", "/auth/", "/checkout", "/order/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
