"use client";

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
import {
  PasswordStrength,
  PasswordStrengthLabel,
} from "@/components/auth/PasswordStrength";
import { createClient } from "@/lib/client";
import { isStrongPassword } from "@/lib/password";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isStrongPassword(password)) {
      setError("Password needs upper, lower, a digit and a symbol");
      return;
    }

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    setPending(true);

    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/account`,
      },
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push(`/auth/sign-up-success?email=${encodeURIComponent(email)}`);
  };

  return (
    <>
      <AuthHeader eyebrow="Account" title="Open an account.">
        One address, one password. We send a link to confirm it, then you order
        ahead and collect at the bar.
      </AuthHeader>

      <form onSubmit={handleSignUp} className="grid gap-[clamp(0.75rem,2.2vh,1.5rem)]">
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-rules"
          aria-invalid={password !== "" && !isStrongPassword(password)}
          hint={<PasswordStrengthLabel value={password} />}
          footer={<PasswordStrength id="password-rules" value={password} />}
        />

        <Field
          id="repeat-password"
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
        />

        <FormError message={error} />

        <Submit pending={pending}>
          {pending ? "Creating account" : "Create account"}
        </Submit>
      </form>

      <SocialAuth next="/account" />

      <AuthNote href="/auth/login" action="Sign in">
        Already with us
      </AuthNote>
    </>
  );
}
