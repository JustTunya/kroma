import { admin } from "@/lib/admin";

// Fires at 20:00 UTC (~22:00-23:00 Bucharest, either DST state) — after the
// shop's 17:00-18:00 close, before midnight, so reset_demo_day()'s
// `(now() at time zone shop_tz())::date` still targets the day that just had
// traffic. Does only this one thing; release-holds owns everything else.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { error } = await admin().rpc("reset_demo_day");
  if (error) {
    console.error("reset_demo_day failed:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
