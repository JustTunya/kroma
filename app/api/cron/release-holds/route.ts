import { admin } from "@/lib/admin";

/**
 * ponytail: card orders no longer hold stock — they are only written once the
 * payment clears — so this drains pending online rows left by the old flow and
 * then finds nothing. Delete the route, its cron entry and release_order() once
 * no such rows remain.
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
