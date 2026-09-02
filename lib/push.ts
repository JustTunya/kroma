import "server-only";
import webpush from "web-push";

import { admin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.error("VAPID keys are not set — push notifications are disabled");
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Pushes to every live subscription on the order, deleting any endpoint that
 * comes back 404 or 410 — a dead endpoint that is never cleaned up is how a
 * push table rots. Falls back to sendEmail when the order has an address and
 * no live subscription (or push is not configured at all).
 */
export async function notifyReady(orderId: string): Promise<void> {
  const db = admin();

  const [{ data: order }, { data: subs }] = await Promise.all([
    db.from("orders").select("access_token, day_number, receipt_email, user_id").eq("id", orderId).maybeSingle(),
    db.from("order_push_subscriptions").select("id, endpoint, p256dh, auth").eq("order_id", orderId),
  ]);
  if (!order) return;

  const ticket = `#${String(order.day_number ?? "").padStart(3, "0")}`;
  const url = `/order/${order.access_token}`;

  configure();
  let pushed = false;

  if (configured && subs && subs.length > 0) {
    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: "KROMA",
              body: `${ticket} is ready at the bar.`,
              url,
            }),
          );
          return true;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from("order_push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("push failed for", sub.id, error);
          }
          return false;
        }
      }),
    );
    pushed = results.some(Boolean);
  }

  if (pushed) return;

  const to = order.receipt_email ?? (await addressOf(order.user_id));
  if (!to) return;

  await sendEmail({
    to,
    subject: `KROMA — ${ticket} is ready`,
    text: `${ticket} is ready at the bar.`,
  });
}

async function addressOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = admin();
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
