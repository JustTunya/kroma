import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [

    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|[0-9a-f]{32}.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
