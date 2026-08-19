import { admin } from "@/lib/admin";

/**
 * Backstop for a checkout.session.expired webhook that never arrived. Without
 * it, one dropped event holds that stock until closing.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data, error } = await admin().rpc("release_expired_orders");

  if (error) {
    console.error("release_expired_orders failed:", error.message);
    return new Response("failed", { status: 500 });
  }

  return Response.json({ released: data });
}
