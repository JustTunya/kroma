"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/client";
import { pressSpring } from "@/lib/motion";
import { glide, rise } from "@/lib/reveal";
import { cn } from "@/lib/utils";

/**
 * The shared parts of every auth screen. The landing page has no card, no
 * shadow and no grey — neither do these: hairlines, mono labels and one
 * terracotta CTA. Form inputs are the one place `rounded-md` is allowed.
 */

/** The panel arrives on the same ease-out as every other block on the site. */
export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={rise}
      transition={glide}
      className="my-auto w-full max-w-md"
    >
      {children}
    </motion.div>
  );
}

export function AuthHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  // Vertical rhythm is `vh`-clamped throughout the auth screens so a form fits
  // a short laptop viewport without scrolling. Type sizes stay in px.
  return (
    <header className="mb-[clamp(1rem,2.6vh,2.5rem)]">
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-[clamp(0.75rem,2vh,1.25rem)] max-w-[14ch] font-serif text-[clamp(30px,min(4vw,5.4vh),52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        {title}
      </h1>
      {children && (
        <p className="mt-[clamp(0.75rem,2vh,1.5rem)] max-w-md text-[15px] leading-[1.6] text-text-secondary">
          {children}
        </p>
      )}
    </header>
  );
}

export function Field({
  label,
  hint,
  footer,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: React.ReactNode;
  /** Rendered under the input — the password meter, and nothing else so far. */
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label
          htmlFor={props.id}
          className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase"
        >
          {label}
        </Label>
        {hint}
      </div>
      <Input
        {...props}
        className={cn(
          "h-11 rounded-md border-hairline bg-surface-card px-3.5 font-mono text-[14px] tracking-[0.02em] text-text-primary placeholder:text-text-tertiary",
          "focus-visible:border-hairline focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
          // The shadcn invalid ring is a cold red — state reads off the meter instead.
          "aria-invalid:border-hairline aria-invalid:ring-0",
          className,
        )}
      />
      {footer}
    </div>
  );
}

/** Errors read like the kitchen, not like a stack trace. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase"
    >
      {message}
    </p>
  );
}

export function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      className="flex h-11 w-full items-center justify-center rounded-full border border-transparent bg-accent-primary font-mono text-[11px] font-semibold tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:border-border-subtle disabled:bg-surface-muted disabled:text-text-tertiary"
    >
      {children}
    </motion.button>
  );
}

/** The one-line link row that closes every form. */
export function AuthNote({
  children,
  href,
  action,
}: {
  children: React.ReactNode;
  href: string;
  action: string;
}) {
  return (
    <p className="mt-[clamp(1.25rem,3.2vh,2rem)] border-t border-hairline pt-[clamp(0.875rem,2.4vh,1.5rem)] font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
      {children}{" "}
      <Link
        href={href}
        className="text-text-primary underline underline-offset-4 transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        {action}
      </Link>
    </p>
  );
}

const PROVIDERS = [
  {
    id: "google",
    label: "Google",
    // simple-icons: Google
    path: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  },
  {
    id: "facebook",
    label: "Facebook",
    // simple-icons: Facebook
    path: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  },
] as const;

/**
 * Google and Facebook. Marks are monochrome on purpose — the palette has no
 * room for two brand blues and a terracotta on the same screen.
 */
export function SocialAuth({ next = "/" }: { next?: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: (typeof PROVIDERS)[number]["id"]) => {
    setPending(provider);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Facebook's `email` scope needs App Review for public login; skip it
        // and stay on public_profile so anyone can sign in without approval.
        ...(provider === "facebook" ? { scopes: "public_profile" } : {}),
        redirectTo: `${window.location.origin}/auth/oauth?next=${encodeURIComponent(next)}`,
      },
    });

    // On success the browser leaves for the provider, so only failure lands here.
    if (error) {
      setError(error.message);
      setPending(null);
    }
  };

  return (
    <div className="mt-[clamp(1.25rem,3.2vh,2rem)]">
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-hairline" />
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Or
        </span>
        <span aria-hidden className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-[clamp(0.875rem,2.4vh,1.5rem)] grid grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => (
          <motion.button
            key={provider.id}
            type="button"
            onClick={() => signIn(provider.id)}
            disabled={pending !== null}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            aria-label={`Continue with ${provider.label}`}
            className="flex h-11 items-center justify-center gap-2.5 rounded-full bg-surface-muted font-mono text-[11px] font-medium tracking-[0.14em] text-text-primary uppercase transition-colors hover:bg-border-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
              <path d={provider.path} />
            </svg>
            {pending === provider.id ? "Opening" : provider.label}
          </motion.button>
        ))}
      </div>

      {/* Only takes vertical space once there is something to say. */}
      {error && (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="flex h-10 items-center justify-center rounded-full bg-surface-muted px-5 font-mono text-[11px] font-medium tracking-[0.14em] text-text-primary uppercase transition-colors hover:bg-border-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      Sign out
    </motion.button>
  );
}
