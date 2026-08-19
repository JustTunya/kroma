import Link from "next/link";

import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";

const PER_PAGE = 20;

/** The bakehouse is in Cluj; the server is in UTC. Without the zone a 00:30
 *  order reads as the previous day on the customer's own history. */
function day(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createClient();

  // No .eq("user_id", …) on purpose: the "orders read own" policy scopes this,
  // and leaning on the policy is what proves the policy works.
  const { data: orders, count } = await supabase
    .from("orders")
    .select("id, order_number, status, total, placed_at, order_items(quantity)", {
      count: "exact",
    })
    .order("placed_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <h1 className="font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        Orders.
      </h1>

      {!orders || orders.length === 0 ? (
        <p className="mt-12 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
          No orders under your name yet.
        </p>
      ) : (
        <ul className="mt-12 divide-y divide-hairline border-y border-hairline">
          {orders.map((order) => {
            const items = (order.order_items as { quantity: number }[] | null) ?? [];
            const cups = items.reduce((sum, item) => sum + item.quantity, 0);
            const label = ORDER_STATUS_LABELS[order.status as OrderStatus];

            return (
              /* ponytail: plain row, not a link — /account/orders/[id] is Task 8 of
                 docs/superpowers/plans/2026-08-19-account-dashboard.md and would 404
                 today. Wrap the row in a Link to that route when it lands. */
              <li
                key={order.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-7 sm:py-9"
              >
                <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
                  #{String(order.order_number).padStart(3, "0")}
                </span>
                <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary">
                  {day(order.placed_at)}
                  <span aria-hidden className="mx-3 text-hairline">
                    /
                  </span>
                  {cups} {cups === 1 ? "item" : "items"}
                </span>
                <span
                  className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${label.tone}`}
                >
                  {label.text}
                </span>
                <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
                  €{Number(order.total).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {lastPage > 1 && (
        <nav
          aria-label="Order history pages"
          className="mt-10 flex items-center justify-between font-mono text-[11px] font-medium tracking-[0.14em] uppercase"
        >
          {page > 1 ? (
            <Link
              href={`/account/orders?page=${page - 1}`}
              className="text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Newer
            </Link>
          ) : (
            <span className="text-hairline">Newer</span>
          )}

          <span className="text-text-tertiary tabular-nums">
            {page} / {lastPage}
          </span>

          {page < lastPage ? (
            <Link
              href={`/account/orders?page=${page + 1}`}
              className="text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Older
            </Link>
          ) : (
            <span className="text-hairline">Older</span>
          )}
        </nav>
      )}
    </>
  );
}
