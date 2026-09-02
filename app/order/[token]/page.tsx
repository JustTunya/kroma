import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatus, type OrderDoc } from "@/components/checkout/OrderStatus";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";
import { createClient } from "@/lib/server";
import { groupByRate, vatLabel } from "@/lib/vat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order — KROMA" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clock(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Guard before the RPC: a non-uuid would raise 22P02 rather than 404.
  if (!UUID.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("order_by_token", { p_token: token });
  if (!data) notFound();

  const order = data as unknown as OrderDoc;

  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-hairline bg-surface-canvas/85 px-5 backdrop-blur-xl sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          <Wordmark className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary" />
        </Link>
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Order
        </span>
      </header>

      <main
        aria-label="Your order"
        className="flex-1 px-5 pt-32 pb-24 sm:px-10 lg:px-14 lg:pt-40 lg:pb-32"
      >
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          {order.customer_name ?? "Collected at the bar"}
        </p>

        {/* The bar calls the day's ticket, not the all-time one. order_number stays as
            the permanent id behind the ledger; day_number is what a person says out loud. */}
        <h1 className="mt-5 font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em] tabular-nums text-text-primary">
          #{String(order.day_number ?? order.order_number).padStart(3, "0")}
        </h1>

        <div className="mt-6">
          <OrderStatus token={token} initial={order} />
        </div>

        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          Ready around {clock(order.pickup_at)}. Give the number at the bar.
        </p>

        <ul className="mt-12 max-w-2xl divide-y divide-hairline border-y border-hairline">
          {order.items.map((item, index) => (
            <li
              key={`${item.item_name}-${index}`}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
            >
              <div>
                <span className="font-serif text-[22px] leading-[1.05] tracking-[-0.02em] text-text-primary">
                  {item.item_name}
                </span>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
                  <span>×{item.quantity}</span>
                  {item.selected_modifiers.map((modifier) => (
                    <span key={modifier.group} className="flex items-center gap-3">
                      <span aria-hidden className="text-hairline">
                        /
                      </span>
                      {modifier.option}
                    </span>
                  ))}
                </p>
              </div>
              <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
                €{Number(item.line_total).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex max-w-2xl items-baseline justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
            Total
          </span>
          <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
            €{Number(order.total).toFixed(2)}
          </span>
        </div>

        {groupByRate(
          order.items.map((item) => ({
            line_total: Number(item.line_total),
            vat_rate: Number(item.vat_rate),
          })),
        ).map(({ rate, vat }) => (
          <p
            key={rate}
            className="mt-2 max-w-2xl text-right font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
          >
            {vatLabel(rate)}
            <span aria-hidden className="mx-3 text-hairline">/</span>
            <span className="tabular-nums">€{vat.toFixed(2)}</span>
          </p>
        ))}
      </main>

      <SiteFooter />
    </>
  );
}
