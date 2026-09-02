import { redirect } from "next/navigation";

import { placeOrderFromSession } from "@/lib/payment";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Where Stripe returns a paid customer. It writes the order rather than
 * displaying one, so a webhook that is slow, blocked or misconfigured never
 * leaves someone who paid without an order — whichever of the two arrives
 * first creates it, and both end up on the same confirmation page.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/checkout");

  const session = await getStripe().checkout.sessions.retrieve(sessionId).catch((error) => {
    console.error("stripe session retrieve failed:", error);
    return null;
  });

  // Unreadable session: nothing was placed, and the cart is still on the
  // checkout page. The webhook still settles a payment that did go through.
  if (!session) redirect("/checkout?payment=unfinished");

  const outcome = await placeOrderFromSession(session);

  if (outcome.status === "placed") redirect(`/order/${outcome.token}`);
  if (outcome.status === "refunded") redirect("/checkout?payment=refunded");
  redirect("/checkout?payment=unfinished");
}
