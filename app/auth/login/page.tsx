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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

      <AuthNote href="/auth/sign-up" action="Create one">
        No account yet
      </AuthNote>
    </>
  );
}
