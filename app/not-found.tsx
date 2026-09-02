import Link from "next/link";

import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";

export const metadata = { title: "Not found — KROMA" };

export default function NotFound() {
  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-hairline bg-surface-canvas/85 px-5 backdrop-blur-xl sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          <Wordmark className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary" />
        </Link>
      </header>

      <main
        aria-label="Not found"
        className="flex-1 px-5 pt-32 pb-24 sm:px-10 lg:px-14 lg:pt-40 lg:pb-32"
      >
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          404
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Nothing on the pass here.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          That page never made it to the counter. Back to the menu.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex h-10 items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          Back to KROMA
        </Link>
      </main>

      <SiteFooter />
    </>
  );
}
