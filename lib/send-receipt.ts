import "server-only";

import { admin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { receiptText, type Receipt } from "@/lib/receipt";

/**
 * Idempotent by receipt_sent_at, which is what makes a Stripe webhook retry
 * harmless. Returns quietly on every failure: an order is not less placed
 * because an email bounced.
 */
export async function sendReceipt(orderId: string): Promise<void> {
  const db = admin();
  const { data } = await db
    .from("orders")
    .select("access_token, receipt_email, receipt_sent_at, user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!data || data.receipt_sent_at) return;

  const to = data.receipt_email ?? (await addressOf(data.user_id));
  if (!to) return;

  const { data: receipt } = await db.rpc("order_receipt", { p_token: data.access_token });
  if (!receipt) return;

  const sent = await sendEmail({
    to,
    subject: `KROMA — order #${String((receipt as Receipt).day_number).padStart(3, "0")}`,
    text: receiptText(receipt as Receipt),
  });

  if (sent) {
    await db.from("orders").update({ receipt_sent_at: new Date().toISOString() }).eq("id", orderId);
  }
}

async function addressOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = admin();
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
