import Link from "next/link";

import { OrderRow } from "@/components/account/OrderRow";
import { menuImage } from "@/lib/menu-images";
import { groupByMonth, summarize } from "@/lib/order-history";
import { type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";
import type { CartLine } from "@/lib/cart";

const PER_PAGE = 20;
const ZONE = "Europe/Bucharest";

type OrderItem = {
  item_name: string;
  base_price: number;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
  menu_item_id: string | null;
  menu_items: { daily_stock: number | null } | null;
};

/** The bakehouse is in Cluj; the server is in UTC. Without the zone a 00:30
 *  order reads as the previous day on the customer's own history. */
function day(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ZONE,
  });
}

/** "August 2026" — the heading a month's worth of orders sits under. */
function month(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: ZONE,
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
  // and leaning on the policy is what proves the policy works. The menu_items
  // join is only there to tell a reorderable line from one that is gone today.
  const { data: orders, count } = await supabase
    .from("orders")
    .select(
      "id, order_number, day_number, status, total, placed_at, order_items(item_name, base_price, quantity, selected_modifiers, menu_item_id, menu_items(daily_stock))",
      { count: "exact" },
    )
    .order("placed_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const rows = (orders ?? []).map((order) => {
    const items = (order.order_items as unknown as OrderItem[] | null) ?? [];

    const available = items.filter(
      (item) => item.menu_item_id && item.menu_items?.daily_stock !== 0,
    );

    return {
      id: order.id,
      month: month(order.placed_at),
      // The bar calls the day's ticket, not the all-time one. order_number stays
      // as the permanent id behind the ledger; day_number is what a person says
      // out loud.
      orderNumber: order.day_number ?? order.order_number,
      date: day(order.placed_at),
      summary: summarize(items),
      status: order.status as OrderStatus,
      total: Number(order.total),
      unavailable: items
        .filter((item) => !item.menu_item_id || item.menu_items?.daily_stock === 0)
        .map((item) => item.item_name),
      lines: available.map<CartLine>((item, index) => ({
        id: `${order.id}-${index}`,
        menuItemId: item.menu_item_id as string,
        name: item.item_name,
        basePrice: Number(item.base_price),
        quantity: item.quantity,
        selectedModifiers: item.selected_modifiers,
        imageUrl: menuImage({ name: item.item_name, category: "", image_url: null }, index),
      })),
    };
  });

  const months = groupByMonth(rows);

  return (
    <>
      <section className="px-5 pt-16 pb-10 sm:px-10 lg:px-14 lg:pt-24">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Every collection
        </p>
        <h1 className="mt-6 font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Orders.
        </h1>
      </section>

      {rows.length === 0 ? (
        <p className="mx-5 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary sm:mx-10 lg:mx-14">
          No orders under your name yet.
        </p>
      ) : (
        <div className="px-5 sm:px-10 lg:px-14">
          {months.map((group) => (
            <section key={group.month} aria-label={group.month}>
              {/* 120px clears the fixed header and the sticky account rail. */}
              <h2 className="sticky top-[120px] z-30 border-y border-hairline bg-surface-canvas/85 py-4 font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase backdrop-blur-xl">
                {group.month}
              </h2>
              <ul className="divide-y divide-hairline">
                {group.rows.map((row) => (
                  <OrderRow
                    key={row.id}
                    orderNumber={row.orderNumber}
                    date={row.date}
                    summary={row.summary}
                    status={row.status}
                    total={row.total}
                    lines={row.lines}
                    unavailable={row.unavailable}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav
          aria-label="Order history pages"
          className="mt-10 flex items-center justify-between px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase sm:px-10 lg:px-14"
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
