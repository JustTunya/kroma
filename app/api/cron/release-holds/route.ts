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

  // Push subscriptions die with the order, but nothing deletes the row once
  // the order settles. Every order this shop has is same-day pickup, so a
  // subscription older than a day belongs to an order long since resolved.
  // The Hobby plan allows one daily cron and this job already runs, so the
  // sweep rides along rather than getting a cron entry of its own.
  const { error: sweepError } = await admin()
    .from("order_push_subscriptions")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (sweepError) console.error("push subscription sweep failed:", sweepError.message);

  return Response.json({ released: data });
}
