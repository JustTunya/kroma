import Link from "next/link";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { DietaryIndex } from "@/components/checkout/DietaryWarning";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";
import { hasPrefs, type DietaryPrefs } from "@/lib/dietary";
import { createClient } from "@/lib/server";

export const metadata = { title: "Checkout — KROMA" };

const NO_PREFS: DietaryPrefs = { diets: [], avoid: [] };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  // Set when a card payment did not end in an order — the cart and the typed-in
  // details are still here, so the customer just presses Pay again.
  const { payment } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, bar_name, dietary_tags, avoid_allergens")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  // The cart lives in the browser for guests, so the empty state is decided
  // client-side by CheckoutForm — not with a redirect from here.
  const defaultName =
    profile?.bar_name?.trim() ||
    profile?.display_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";

  const dietaryPrefs: DietaryPrefs = profile
    ? { diets: profile.dietary_tags, avoid: profile.avoid_allergens }
    : NO_PREFS;

  // Only worth a round trip if there is something to check against. The table is
  // a couple of dozen rows, so it comes back whole rather than filtered by cart —
  // the cart is client-side and this page has never seen it.
  //
  // ponytail: no menu.json fallback here. If the query fails the notice simply
  // does not appear; nothing on this page depends on it to take an order.
  const { data: menuDietary } = hasPrefs(dietaryPrefs)
    ? await supabase.from("menu_items").select("id, dietary_tags, allergens")
    : { data: null };

  const dietaryIndex: DietaryIndex = Object.fromEntries(
    (menuDietary ?? []).map((item) => [
      item.id,
      { dietary_tags: item.dietary_tags, allergens: item.allergens },
    ]),
  );

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
          Checkout
        </span>
      </header>

      <main
        aria-label="Checkout"
        className="flex-1 px-5 pt-32 pb-24 sm:px-10 lg:px-14 lg:pt-40 lg:pb-32"
      >
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Collected at the bar
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Nearly yours.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          Ready in 8-12 minutes. Give a name for the pass and choose how you
          would like to settle it.
        </p>

        <div className="mt-16">
          <CheckoutForm
            signedIn={Boolean(user)}
            defaultName={defaultName}
            paymentNotice={payment === "unfinished" || payment === "refunded" ? payment : undefined}
            dietaryPrefs={dietaryPrefs}
            dietaryIndex={dietaryIndex}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
