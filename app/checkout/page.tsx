import Link from "next/link";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { createClient } from "@/lib/server";

export const metadata = { title: "Checkout — KROMA" };

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The cart lives in the browser for guests, so the empty state is decided
  // client-side by CheckoutForm — not with a redirect from here.
  const defaultName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-hairline bg-surface-canvas/85 px-5 backdrop-blur-xl sm:px-10 lg:px-14">
        <Link
          href="/"
          className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          KROMA
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
          <CheckoutForm signedIn={Boolean(user)} defaultName={defaultName} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
