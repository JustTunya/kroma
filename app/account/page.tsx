import type { Metadata } from "next";

import { AccountBand } from "@/components/account/AccountBand";
import { AlsoOrdered, type Also } from "@/components/account/AlsoOrdered";
import { BarProfile } from "@/components/account/BarProfile";
import { LiveOrder } from "@/components/account/LiveOrder";
import { Rhythm } from "@/components/account/Rhythm";
import { Marquee, type MarqueeEntry } from "@/components/Marquee";
import { rhythm, tally, type HistoryOrder } from "@/lib/account-stats";
import { UsualPanel } from "@/components/account/UsualPanel";
import { WeeklyDrop } from "@/components/account/WeeklyDrop";
import type { OrderStatus } from "@/lib/order-status";
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

// Private page: keep it out of search results.
export const metadata: Metadata = {
  title: "Your account — KROMA",
  robots: { index: false, follow: false },
};

const ZONE = "Europe/Bucharest";
// ponytail: newest 200 orders feed the stats. Move to an RPC aggregate when anyone passes that.
const HISTORY = 200;
const COUNTED: OrderStatus[] = ["paid", "preparing", "ready", "collected"];

type Row = HistoryOrder & {
  placed_at: string;
  total: number;
  order_items: (HistoryOrder["order_items"][number] & {
    menu_items: {
      base_price: number;
      daily_stock: number | null;
      image_url: string | null;
      menu_categories: { name: string } | null;
    } | null;
  })[];
};

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

export default async function AccountOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: card }, { data: usualRaw }, { data: history }, { data: drop }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, bar_name, dietary_tags, avoid_allergens").eq("id", user!.id).maybeSingle(),
      supabase.rpc("my_card"),
      supabase.rpc("my_usual"),

      supabase
        .from("orders")
        .select(
          "placed_at, total, order_items(menu_item_id, item_name, quantity, selected_modifiers, menu_items(base_price, daily_stock, image_url, menu_categories(name)))",
        )
        .in("status", COUNTED)
        .order("placed_at", { ascending: false })
        .limit(HISTORY),

      supabase
        .from("menu_items")
        .select("name, description, base_price, image_url, dietary_tags, menu_categories (name)")
        .eq("is_featured", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

  const balance = card as { punches?: number; redeemed_count?: number } | null;
  const punches = balance?.punches ?? 0;
  const redeemed = balance?.redeemed_count ?? 0;
  const left = Math.max(0, 10 - punches);
  const usual = usualRaw as unknown as Usual | null;
  const orders = (history ?? []) as unknown as Row[];
  const placed = orders.length;
  const spent = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const items = tally(orders);
  const meta = new Map(
    orders.flatMap((o) => o.order_items).flatMap((l) => (l.menu_item_id && l.menu_items ? [[l.menu_item_id, l.menu_items] as const] : [])),
  );

  const also: Also[] = items
    .filter((i) => i.id !== usual?.menu_item_id && meta.has(i.id))
    .slice(0, 3)
    .map((i) => {
      const m = meta.get(i.id)!;
      const soldOut = m.daily_stock === 0;
      const image = menuImage(
        { name: i.name, category: m.menu_categories?.name ?? "", image_url: m.image_url },
        0,
      );

      return {
        id: i.id,
        name: i.name,
        price: Number(m.base_price),
        spec: [i.modifiers.map((x) => x.option).join(" / ") || "As it comes", `Ordered ${i.quantity}×`],
        imageUrl: image,
        soldOut,
        lines: soldOut
          ? []
          : [
              {
                id: `also-${i.id}`,
                menuItemId: i.id,
                name: i.name,
                basePrice: Number(m.base_price),
                quantity: 1,
                selectedModifiers: i.modifiers,
                imageUrl: image,
                vatRate: 0.11,
              },
            ],
      };
    });

  const last = orders[0]
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: ZONE,
      }).format(new Date(orders[0].placed_at))
    : null;

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
            imageUrl: menuImage({ name: usual.name, category: "", image_url: usual.image_url }, 0),
            vatRate: 0.11,
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

  const ticker: MarqueeEntry[] = [
    ...details.map((label) => ({ label })),
    ...(last ? [{ label: `Last order ${last.replace(",", "")}` }] : []),
    { label: `${left === 0 ? "Card full" : `${left} to the free one`}` },
    { label: "Mon–Fri 07:30–18:00" },
    { label: "Sat–Sun 08:30–17:00" },
  ];

  return (
    <>
      <LiveOrder />
      <AccountBand greeting={greeting()} name={name} punches={punches} details={details} />
      <Marquee label="Your account at a glance" entries={ticker} duration={60} />

      {!usual ? (
        <section
          aria-label="Your usual"
          className="border-b border-hairline px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
        >
          <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-text-secondary uppercase">
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

          imageUrl={menuImage({ name: usual.name, category: "", image_url: usual.image_url }, 0)}
          soldOut={Boolean(soldOut)}
          lines={usualLine}
        />
      )}

      {drop && (
        <WeeklyDrop
          name={drop.name}
          description={drop.description}
          price={Number(drop.base_price)}
          spec={[drop.menu_categories?.name, ...drop.dietary_tags].filter(
            (part): part is string => Boolean(part),
          )}
          imageUrl={menuImage(
            { name: drop.name, category: drop.menu_categories?.name ?? "", image_url: drop.image_url },
            0,
          )}
        />
      )}

      {also.length > 0 && <AlsoOrdered items={also} />}

      <Rhythm
        rhythm={rhythm(orders.map((o) => o.placed_at))}
        since={since}
        stats={[
          { label: orderCount, value: String(placed) },
          { label: "Different items", value: String(items.length) },
          { label: "Spent", value: `€${spent.toFixed(0)}` },
          { label: "On us", value: String(redeemed) },
        ]}
        average={placed > 0 ? `Average order €${(spent / placed).toFixed(2)}` : null}
      />

      <section aria-label="The card and your bar" className="grid border-b border-hairline md:grid-cols-2">
        <div className="border-b border-hairline px-5 py-16 sm:px-10 md:border-b-0 lg:px-14 lg:py-24">
          <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-accent-hover uppercase">
            The card
          </h2>
          <p className="mt-6 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
            Ten cups, then one on us
          </p>
          <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
            Every drink off the bar earns a punch. Bakehouse and kitchen do not count.
            Nothing expires — the card waits as long as you do, and you pick the free
            one at checkout.
          </p>
          <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase">
            {["10 punches", "1 per drink", "No expiry"].map((stat, index) => (
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

        <BarProfile
          called={profile?.bar_name?.trim() || name}
          diet={profile?.dietary_tags ?? []}
          avoiding={profile?.avoid_allergens ?? []}
        />
      </section>
    </>
  );
}
