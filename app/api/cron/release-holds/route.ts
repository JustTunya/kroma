import { admin } from "@/lib/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data, error } = await admin().rpc("release_expired_orders");

  if (error) {
    console.error("release_expired_orders failed:", error.message);
    return new Response("failed", { status: 500 });
  }

  const { data: opener } = await admin()
    .from("staff")
    .select("id")
    .eq("kind", "person")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (opener) {
    const { error: openError } = await admin().rpc("open_service", { p_actor: opener.id });
    if (openError) console.error("open_service failed:", openError.message);
  }

  const { error: sweepError } = await admin()
    .from("order_push_subscriptions")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (sweepError) console.error("push subscription sweep failed:", sweepError.message);

  return Response.json({ released: data });
}
