"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthHeader,
  AuthNote,
  Field,
  FormError,
  Submit,
} from "@/components/auth/AuthForm";
import {
  PasswordStrength,
  PasswordStrengthLabel,
} from "@/components/auth/PasswordStrength";
import { createClient } from "@/lib/client";
import { isStrongPassword } from "@/lib/password";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleUpdate = async (event: React.FormEvent) => {
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

    const { error } = await createClient().auth.updateUser({ password });

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
      <AuthHeader eyebrow="Reset" title="Set a new password.">
        Eight characters, mixed case, a digit and a symbol. It takes effect
        immediately, on every device.
      </AuthHeader>

      <form onSubmit={handleUpdate} className="grid gap-[clamp(0.75rem,2.2vh,1.5rem)]">
        <Field
          id="password"
          label="New password"
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

        <Submit pending={pending}>{pending ? "Saving" : "Save password"}</Submit>
      </form>

      <AuthNote href="/auth/forgot-password" action="Send another">
        Link expired
      </AuthNote>
    </>
  );
}
