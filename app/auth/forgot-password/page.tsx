"use client";

import { useState } from "react";

import {
  AuthHeader,
  AuthNote,
  Field,
  FormError,
  Submit,
} from "@/components/auth/AuthForm";
import { createClient } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  };

  if (sent) {
    return (
      <>
        <AuthHeader eyebrow="Reset" title="Check your inbox.">
          If that address is on an account, a reset link is on its way. It
          expires in an hour.
        </AuthHeader>

        <AuthNote href="/auth/login" action="Sign in">
          Remembered it
        </AuthNote>
      </>
    );
  }

  return (
    <>
      <AuthHeader eyebrow="Reset" title="Send a reset link.">
        Type the address on the account. We send a link that sets a new
        password.
      </AuthHeader>

      <form onSubmit={handleReset} className="grid gap-[clamp(0.75rem,2.2vh,1.5rem)]">
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

        <FormError message={error} />

        <Submit pending={pending}>
          {pending ? "Sending" : "Send reset link"}
        </Submit>
      </form>

      <AuthNote href="/auth/login" action="Sign in">
        Remembered it
      </AuthNote>
    </>
  );
}
