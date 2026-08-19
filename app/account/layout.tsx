import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/AuthForm";
import { AccountNav, type AccountNavItem } from "@/components/account/AccountNav";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";
import { createClient } from "@/lib/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects, this is the belt to its braces.
  if (!user) redirect("/auth/login");

  // Card and Settings are Tasks 9-10 of
  // docs/superpowers/plans/2026-08-19-account-dashboard.md and don't exist yet.
  // Restore them there by adding array entries — AccountNav itself needs no changes.
  const items: AccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/orders", label: "Orders" },
  ];

  return (
    <>
      {/* ponytail: the bar stays on canvas even where the band behind it is dark.
          Invert it on scroll the way StorefrontHeader does if the seam reads wrong. */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-hairline bg-surface-canvas/85 px-5 backdrop-blur-xl sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          <Wordmark className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary" />
        </Link>
        <SignOutButton />
      </header>

      <main className="flex-1 pt-16">
        {/* Parks exactly under the header, the slot CategoryNav uses on the storefront. */}
        <div className="sticky top-16 z-40 border-b border-hairline bg-surface-canvas/85 backdrop-blur-xl">
          <div className="flex h-14 items-center px-5 sm:px-10 lg:px-14">
            <AccountNav items={items} />
          </div>
        </div>

        {/* Sections are full-bleed and carry their own gutters — no wrapper here. */}
        {children}
      </main>

      <SiteFooter />
    </>
  );
}
