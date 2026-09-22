"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthHeader,
  AuthNote,
  Field,
  FormError,
  SocialAuth,
  Submit,
} from "@/components/auth/AuthForm";
import { createClient } from "@/lib/client";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD;
const DEMO_PIN = process.env.NEXT_PUBLIC_DEMO_STAFF_PIN;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push("/account");
    router.refresh();
  };

  const handleDemoStaffLogin = async () => {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) return;
    setDemoPending(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error) {
      setError(error.message);
      setDemoPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <AuthHeader eyebrow="Account" title="Sign in to order ahead.">
        Past orders, saved regulars, and a shorter wait at the bar.
      </AuthHeader>

      <form onSubmit={handleLogin} className="grid gap-[clamp(0.75rem,2.2vh,1.5rem)]">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            <Link
              href="/auth/forgot-password"
              className="font-mono text-[10px] font-medium tracking-[0.14em] text-text-tertiary uppercase underline underline-offset-4 transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Forgotten
            </Link>
          }
        />

        <FormError message={error} />

        <Submit pending={pending}>{pending ? "Signing in" : "Sign in"}</Submit>
      </form>

      <SocialAuth next="/account" />

      {DEMO_EMAIL && DEMO_PASSWORD && DEMO_PIN ? (
        <p className="mt-[clamp(1.25rem,3.2vh,2rem)] border-t border-hairline pt-[clamp(0.875rem,2.4vh,1.5rem)] font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
          Curious about the staff side?{" "}
          <button
            type="button"
            onClick={handleDemoStaffLogin}
            disabled={demoPending}
            className="text-text-primary underline underline-offset-4 transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary"
          >
            {demoPending ? "Signing in" : `Try the staff side — PIN ${DEMO_PIN}`}
          </button>
        </p>
      ) : null}

      <AuthNote href="/auth/sign-up" action="Create one">
        No account yet
      </AuthNote>
    </>
  );
}
