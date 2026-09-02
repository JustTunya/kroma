"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        aria-label="Something went wrong"
        className="flex-1 px-5 pt-32 pb-24 sm:px-10 lg:px-14 lg:pt-40 lg:pb-32"
      >
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase">
          Kitchen error
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          That dropped on the floor.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          Something went wrong on our side. Nothing was lost — try again.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-full bg-surface-muted px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-text-primary uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            Back to KROMA
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
