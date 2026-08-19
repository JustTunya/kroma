import { AccountBand } from "@/components/account/AccountBand";
import { UsualPanel } from "@/components/account/UsualPanel";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { menuImage } from "@/lib/menu-images";
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

const ZONE = "Europe/Bucharest";

/** Opening hours are 07:30, and they are 07:30 in Cluj, not on the server. */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: ZONE,
    }).format(new Date()),
  );

  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

function month(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date(value));
}

function day(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: ZONE,
  }).format(new Date(value));
}

export default async function AccountOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: card }, { data: usualRaw }, { data: orders, count }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
      supabase.rpc("my_card"),
      supabase.rpc("my_usual"),
      // The "orders read own" policy scopes both the row and the count.
      supabase
        .from("orders")
        .select("id, order_number, status, total, placed_at", { count: "exact" })
        .order("placed_at", { ascending: false })
        .limit(1),
    ]);

  const balance = card as { punches?: number; redeemed_count?: number } | null;
  const punches = balance?.punches ?? 0;
  const redeemed = balance?.redeemed_count ?? 0;
  const left = Math.max(0, 12 - punches);
  const usual = usualRaw as unknown as Usual | null;
  const last = orders?.[0];
  const placed = count ?? 0;

  const name = profile?.display_name?.trim() || user!.email?.split("@")[0] || "You";
  const since = month(user!.created_at);
  const soldOut = usual?.daily_stock === 0;

  const usualLine: CartLine[] =
    usual && !soldOut
      ? [
          {
            id: `usual-${usual.menu_item_id}`,
            menuItemId: usual.menu_item_id,
            name: usual.name,
            basePrice: Number(usual.base_price),
            quantity: 1,
            selectedModifiers: usual.selected_modifiers,
            imageUrl: menuImage({ category: "", image_url: usual.image_url }, 0),
          },
        ]
      : [];

  const orderCount = `${placed} ${placed === 1 ? "order" : "orders"}`;

  const details = [
    `Member since ${since}`,
    `${orderCount} placed`,
    redeemed > 0
      ? `${redeemed} on us so far`
      : left === 0
        ? "One on us, waiting"
        : "No cup claimed yet",
  ];

  return (
    <>
      <AccountBand greeting={greeting()} name={name} punches={punches} details={details} />

      {!usual ? (
        <section
          aria-label="Your usual"
          className="border-b border-hairline px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
        >
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
            Your usual
          </p>
          <p className="mt-8 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            Nothing ordered twice yet.
          </p>
        </section>
      ) : (
        <UsualPanel
          name={usual.name}
          price={Number(usual.base_price)}
          spec={[
            usual.selected_modifiers.map((m) => m.option).join(" / ") || "As it comes",
            `Ordered ${usual.times_ordered}×`,
            ...(soldOut ? ["Gone for today"] : []),
          ]}
          /* ponytail: my_usual() returns no category, so a row without its own
             image_url falls to the default frame instead of its category pool.
             Add category to the RPC's jsonb and pass it through to fix. */
          imageUrl={menuImage({ category: "", image_url: usual.image_url }, 0)}
          soldOut={Boolean(soldOut)}
          lines={usualLine}
        />
      )}

      <section
        aria-label="Last order"
        className="border-b border-hairline px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
      >
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Last order
        </p>

        {!last ? (
          <p className="mt-8 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            No orders under your name yet.
          </p>
        ) : (
          /* Plain row, not a link: /account/orders/[id] arrives with Task 8 of
             docs/superpowers/plans/2026-08-19-account-dashboard.md. Wrap this in
             a Link to that route when it exists. */
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-hairline py-7 sm:py-9">
            <span className="font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] text-text-primary tabular-nums">
              #{String(last.order_number).padStart(3, "0")}
            </span>
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
              {day(last.placed_at)}
            </span>
            <span
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                ORDER_STATUS_LABELS[last.status as OrderStatus].tone
              }`}
            >
              {ORDER_STATUS_LABELS[last.status as OrderStatus].text}
            </span>
            <span className="font-mono text-[15px] font-medium tracking-[0.02em] text-text-primary tabular-nums">
              €{Number(last.total).toFixed(2)}
            </span>
          </div>
        )}
      </section>

      <section aria-label="How the card works" className="grid md:grid-cols-2">
        <div className="border-b border-hairline px-5 py-16 sm:px-10 md:border-b-0 lg:px-14 lg:py-24">
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
            The card
          </p>
          <h2 className="mt-6 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
            Twelve cups, then one on us
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
            Every drink off the bar earns a punch. Bakehouse and kitchen do not count.
            Nothing expires — the card waits as long as you do, and you pick the free
            one at checkout.
          </p>
          <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            {["12 punches", "1 per drink", "No expiry"].map((stat, index) => (
              <li key={stat} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden className="text-hairline">
                    /
                  </span>
                )}
                {stat}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-hairline px-5 py-16 sm:px-10 md:border-l lg:px-14 lg:py-24">
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
            Your habit
          </p>
          <h2 className="mt-6 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
            {usual ? `Mostly the ${usual.name.toLowerCase()}` : "Still working it out"}
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
            {usual
              ? "Order it again in one tap and it lands in the cart as you take it. Change your mind at checkout — nothing is locked in until you pay."
              : "Order the same thing twice and it shows up here, ready to reorder in one tap."}
          </p>
          <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            {[
              `Since ${since}`,
              orderCount,
              usual ? `${usual.times_ordered}× the usual` : "No usual yet",
            ].map((stat, index) => (
              <li key={stat} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden className="text-hairline">
                    /
                  </span>
                )}
                {stat}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
