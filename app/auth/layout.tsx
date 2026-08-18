import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuthPanel } from "@/components/auth/AuthForm";
import { AuthHeroCopy } from "@/components/auth/AuthHeroCopy";

export const metadata: Metadata = {
  title: "Account — KROMA Coffee & Bakehouse",
};

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
      <aside className="relative hidden overflow-hidden bg-text-primary lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/kroma_bg.webp"
          alt="KROMA Coffee & Bakehouse"
          fill
          sizes="50vw"
          priority
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-text-primary/95 via-text-primary/45 to-text-primary/5"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-text-primary/80 via-text-primary/25 to-transparent"
        />

        <div className="relative flex h-16 items-center px-14">
          <Link
            href="/"
            className="font-serif text-[26px] leading-none tracking-[-0.02em] text-surface-canvas focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-surface-canvas"
          >
            KROMA
          </Link>
        </div>

        <AuthHeroCopy />
      </aside>

      <main className="flex flex-col px-5 py-[clamp(1.5rem,4vh,3.5rem)] sm:px-10 lg:border-l lg:border-hairline lg:px-14">
        <Link
          href="/"
          className="mb-[clamp(1rem,2.6vh,3rem)] font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus lg:hidden"
        >
          KROMA
        </Link>

        <AuthPanel>{children}</AuthPanel>
      </main>
    </div>
  );
}
