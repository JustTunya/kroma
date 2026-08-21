import Link from "next/link";

import {
  DeleteAccountForm,
  DietForm,
  PreferencesForm,
  ProfileForm,
  SignOutEverywhereForm,
} from "@/components/account/SettingsForms";
import { createClient } from "@/lib/server";
import {
  deleteAccount,
  savePreferences,
  saveProfile,
  saveDiet,
  signOutEverywhere,
} from "../actions";

export const metadata = { title: "Settings — KROMA" };

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  facebook: "Facebook",
};

/**
 * Every block is the same shape: a mono heading and its one sentence on the
 * left, the controls on the right, a hairline underneath. Same full-bleed rule
 * as the storefront — the section owns its gutters, nothing is boxed.
 */
function Block({
  title,
  note,
  tone = "default",
  children,
}: {
  title: string;
  note: string;
  tone?: "default" | "alert";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="grid gap-8 border-t border-hairline px-5 py-12 sm:px-10 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)] md:gap-x-12 lg:px-14 lg:gap-x-20 lg:py-16"
    >
      <div>
        <h2
          className={`font-mono text-[10px] font-medium tracking-[0.18em] uppercase ${
            tone === "alert" ? "text-badge-alert" : "text-accent-primary"
          }`}
        >
          {title}
        </h2>
        <p className="mt-4 max-w-[26ch] text-[15px] leading-[1.55] text-text-secondary">
          {note}
        </p>
      </div>
      {/* Capped: a label at the gutter and its switch 1200px away is a long throw. */}
      <div className="min-w-0 max-w-3xl">{children}</div>
    </section>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
      <dt className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
        {term}
      </dt>
      <dd className="font-mono text-[13px] tracking-[0.02em] text-text-primary">{children}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bar_name, phone, dietary_tags, avoid_allergens, marketing_opt_in")
    .eq("id", user!.id)
    .maybeSingle();

  const provider = user!.app_metadata.provider ?? "email";
  const verified = Boolean(user!.email_confirmed_at);

  return (
    <>
      <header className="px-5 pt-16 pb-12 sm:px-10 lg:px-14 lg:pt-24 lg:pb-16">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Yours to change
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
          Settings.
        </h1>
        <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          What we call you, what you will not eat, and what we are allowed to send.
          Saved the moment you press it — nothing waits for a second confirmation.
        </p>
      </header>

      <Block
        title="Profile"
        note="Who the account belongs to, and what the barista shouts when it is ready."
      >
        <ProfileForm
          action={saveProfile}
          displayName={profile?.display_name ?? ""}
          barName={profile?.bar_name ?? ""}
          phone={profile?.phone ?? ""}
        />
      </Block>

      <Block
        title="Diet"
        note="Set once here and the checkout flags anything on the pass that does not match, before you pay."
      >
        <DietForm
          action={saveDiet}
          diets={profile?.dietary_tags ?? []}
          avoid={profile?.avoid_allergens ?? []}
        />
      </Block>

      <Block title="Notes" note="One letter, not a newsletter. Off by default, off for good if you say so.">
        <PreferencesForm
          action={savePreferences}
          marketingOptIn={profile?.marketing_opt_in ?? false}
        />
      </Block>

      <Block title="Security" note="How you get in, and how to shut every way in at once.">
        <dl className="divide-y divide-hairline border-y border-hairline">
          <Detail term="Email">{user!.email}</Detail>
          <Detail term="Email status">
            <span
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                verified ? "text-badge-live" : "text-badge-alert"
              }`}
            >
              {verified ? "Verified" : "Not verified yet"}
            </span>
          </Detail>
          <Detail term="Signed in with">{PROVIDER_LABELS[provider] ?? provider}</Detail>
        </dl>

        <Link
          href="/auth/update-password"
          className="mt-6 inline-block font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase transition-colors duration-300 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          Change password
        </Link>

        <SignOutEverywhereForm action={signOutEverywhere} />
      </Block>

      <Block
        title="Delete account"
        tone="alert"
        note="The way out. It takes effect immediately and there is no undo."
      >
        <DeleteAccountForm action={deleteAccount} />
      </Block>
    </>
  );
}
