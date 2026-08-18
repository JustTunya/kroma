import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/middleware";

/**
 * Refreshes the Supabase session cookie on every request and guards /account.
 * Next 16 calls this file `proxy`; it is the former `middleware`.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images — those never need a session
     * refresh and would double the auth traffic for nothing.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
