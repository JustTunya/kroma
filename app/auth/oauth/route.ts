import { NextResponse } from "next/server";

import { createClient } from "@/lib/server";

/** Google and Facebook redirect back here with a PKCE code to exchange. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") ? requestedNext : "/account";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Behind a load balancer the origin is the internal host, so trust the
      // forwarded one in production.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const base =
        process.env.NODE_ENV === "development" || !forwardedHost
          ? origin
          : `https://${forwardedHost}`;

      return NextResponse.redirect(`${base}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error.message)}`,
    );
  }

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent(providerError ?? "No code in callback")}`,
  );
}
