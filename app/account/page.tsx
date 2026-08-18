import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/AuthForm";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { createClient } from "@/lib/server";

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  facebook: "Facebook",
};

function day(value: string | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects, this is the belt to its braces.
  if (!user) redirect("/auth/login");

  const provider = user.app_metadata.provider ?? "email";
  const verified = Boolean(user.email_confirmed_at);

  const rows = [
    { label: "Email", value: user.email ?? "—" },
    { label: "Signed in with", value: PROVIDER_LABELS[provider] ?? provider },
    { label: "Member since", value: day(user.created_at) },
    { label: "Last seen", value: day(user.last_sign_in_at ?? undefined) },
  ];

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

      <main className="flex-1 px-5 pt-32 pb-24 sm:px-10 lg:px-14 lg:pt-40 lg:pb-32">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Account
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Signed in.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          Orders placed from here are held under your name and collected at the
          bar.
        </p>

        <dl className="mt-12 max-w-2xl divide-y divide-hairline border-y border-hairline">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
            >
              <dt className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
                {row.label}
              </dt>
              <dd className="font-mono text-[13px] tracking-[0.02em] text-text-primary">
                {row.value}
              </dd>
            </div>
          ))}

          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
            <dt className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
              Email status
            </dt>
            <dd
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                verified ? "text-badge-live" : "text-badge-alert"
              }`}
            >
              {verified ? "Verified" : "Not verified yet"}
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SignOutButton />
          <Link
            href="/auth/update-password"
            className="flex h-10 items-center justify-center rounded-full px-5 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            Change password
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
