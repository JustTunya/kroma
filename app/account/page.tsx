import { PunchCard } from "@/components/account/PunchCard";
import { ReorderButton } from "@/components/account/ReorderButton";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";
import type { CartLine } from "@/lib/cart";

type Usual = {
  menu_item_id: string;
  name: string;
  base_price: number;
  daily_stock: number | null;
  image_url: string | null;
  times_ordered: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
};

/** Opening hours are 07:30; anything before noon is still morning at the bar. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

export default async function AccountOverviewPage() {
  const supabase = await createClient();

  const [{ data: card }, { data: usualRaw }, { data: orders }] = await Promise.all([
    supabase.rpc("my_card"),
    supabase.rpc("my_usual"),
    supabase
      .from("orders")
      .select("id, order_number, status, total, placed_at")
      .order("placed_at", { ascending: false })
      .limit(1),
  ]);

  const punches = (card as { punches?: number } | null)?.punches ?? 0;
  const usual = usualRaw as unknown as Usual | null;
  const last = orders?.[0];

  const usualLine: CartLine[] =
    usual && usual.daily_stock !== 0
      ? [
          {
            id: `usual-${usual.menu_item_id}`,
            menuItemId: usual.menu_item_id,
            name: usual.name,
            basePrice: Number(usual.base_price),
            quantity: 1,
            selectedModifiers: usual.selected_modifiers,
            imageUrl: usual.image_url ?? "",
          },
        ]
      : [];

  return (
    <>
      <h1 className="max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        {greeting()}
      </h1>

      {/* The card */}
      <section aria-label="Your card" className="mt-12 border-y border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Your card
        </p>
        <div className="mt-6">
          <PunchCard punches={punches} />
        </div>
      </section>

      {/* Your usual */}
      <section aria-label="Your usual" className="border-b border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Your usual
        </p>

        {!usual ? (
          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            Nothing ordered twice yet.
          </p>
        ) : (
          <>
            <p className="mt-4 font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
              {usual.name}
            </p>
            <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary">
              {usual.selected_modifiers.map((m) => m.option).join(" / ") || "As it comes"}
              <span aria-hidden className="mx-3 text-hairline">
                /
              </span>
              Ordered {usual.times_ordered}×
            </p>
            <div className="mt-6">
              <ReorderButton lines={usualLine} label="Order again" />
            </div>
          </>
        )}
      </section>

      {/* Last order */}
      <section aria-label="Last order" className="border-b border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Last order
        </p>

        {!last ? (
          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            No orders under your name yet.
          </p>
        ) : (
          /* Plain row, not a link: /account/orders/[id] arrives with Task 8 of
             docs/superpowers/plans/2026-08-19-account-dashboard.md. Wrap this in
             a Link to that route when it exists. */
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
              #{String(last.order_number).padStart(3, "0")}
            </span>
            <span
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                ORDER_STATUS_LABELS[last.status as OrderStatus].tone
              }`}
            >
              {ORDER_STATUS_LABELS[last.status as OrderStatus].text}
            </span>
            <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
              €{Number(last.total).toFixed(2)}
            </span>
          </div>
        )}
      </section>
    </>
  );
}
