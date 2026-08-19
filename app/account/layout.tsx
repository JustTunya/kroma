import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/AuthForm";
import { AccountNav, type AccountNavItem } from "@/components/account/AccountNav";
import { SiteFooter } from "@/components/storefront/SiteFooter";
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

  const [{ data: profile }, { data: card }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_card"),
  ]);

  const punches = (card as { punches?: number } | null)?.punches ?? 0;

  const items: AccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/card", label: "Card", badge: `${punches}/12` },
    { href: "/account/settings", label: "Settings" },
  ];

  const name = profile?.display_name?.trim() || user.email?.split("@")[0] || "You";

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
          Account
        </span>
      </header>

      <main className="flex-1 px-5 pt-24 pb-24 sm:px-10 lg:px-14 lg:pt-32 lg:pb-32">
        <div className="grid gap-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-0">
          <div className="md:sticky md:top-24 md:self-start md:pr-10">
            <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
              {name}
            </p>
            <div className="mt-6 border-y border-hairline py-2 md:border-b-0">
              <AccountNav items={items} />
            </div>
            <div className="mt-6 hidden md:block">
              <SignOutButton />
            </div>
          </div>

          <div className="md:border-l md:border-hairline md:pl-10 lg:pl-14">{children}</div>
        </div>

        <div className="mt-16 md:hidden">
          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
