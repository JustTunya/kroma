import Link from "next/link";

import { SiteFooter } from "@/components/storefront/SiteFooter";
import { Wordmark } from "@/components/Logo";

export const metadata = {
  title: "Privacy — KROMA Coffee & Bakehouse",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline py-9">
      <h2 className="font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
        {title}
      </h2>
      <div className="mt-3 max-w-lg text-[15px] leading-[1.6] text-text-secondary">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <header className="flex h-16 items-center border-b border-hairline px-5 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          <Wordmark className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary" />
        </Link>
      </header>

      <main className="flex-1 px-5 py-16 sm:px-10 lg:px-14 lg:py-24">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Last updated September 2026
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Privacy.
        </h1>
        <p className="mt-6 max-w-lg text-[16px] leading-[1.6] text-text-secondary">
          KROMA is a portfolio project — a demo storefront, not a company. This page exists so sign-in
          through Google and Facebook can work. Here is what that means in practice.
        </p>

        <div className="mt-10">
          <Section title="What we collect">
            When you sign in, your provider (Google or Facebook) shares a name, an email address where
            available, and a profile photo. If you place a demo order, we store what you typed at
            checkout — name, contact detail, order items.
          </Section>
          <Section title="What we do with it">
            Nothing beyond running the demo: showing your account, your order history, your loyalty
            punches. Never sold, never shared with a third party, never used for marketing outside the
            optional in-app preference you control in Settings.
          </Section>
          <Section title="How to remove it">
            Email the address below and every record tied to your account is deleted within a week.
            Nothing here is retained for any purpose once you ask.
          </Section>
          <Section title="Contact">
            This is a portfolio demo without a support inbox. If Facebook or Google needs a live
            contact address here, replace this line with one before submitting the app for review.
          </Section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
