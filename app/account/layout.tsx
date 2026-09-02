import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { SignOutButton } from "@/components/auth/AuthForm";
import { AccountNav, type AccountNavItem } from "@/components/account/AccountNav";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";
import { createClient } from "@/lib/server";
import { currentStaff } from "@/lib/staff";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const items: AccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/settings", label: "Settings" },
  ];

  const staff = await currentStaff();

  return (
    <>
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
        {}
        <div className="sticky top-16 z-40 border-b border-hairline bg-surface-canvas/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-4 px-5 sm:px-10 lg:px-14">
            <AccountNav items={items} />
            {staff && (
              <Link
                href="/dashboard"
                className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-primary px-4 font-mono text-[10px] font-medium tracking-[0.16em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Dashboard
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        {}
        {children}
      </main>

      <SiteFooter />
    </>
  );
}
