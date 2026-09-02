import { redirect } from "next/navigation";

import { placeOrderFromSession } from "@/lib/payment";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

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

  if (!session) redirect("/checkout?payment=unfinished");

  const outcome = await placeOrderFromSession(session);

  if (outcome.status === "placed") redirect(`/order/${outcome.token}`);
  if (outcome.status === "refunded") redirect("/checkout?payment=refunded");
  redirect("/checkout?payment=unfinished");
}
