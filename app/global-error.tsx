"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Only fires when the root layout itself throws. Renders its own html/body
 * since it replaces layout.tsx entirely — kept plain, no fonts or header, so
 * it never depends on the thing that just broke.
 */
export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-start justify-center bg-surface-canvas px-5 text-text-primary sm:px-10 lg:px-14">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase">
          Kitchen error
        </p>
        <h1 className="mt-5 max-w-[14ch] text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          That dropped on the floor.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          Something went wrong loading KROMA. Try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 inline-flex h-10 items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
