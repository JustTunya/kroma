import { AuthHeader, AuthNote } from "@/components/auth/AuthForm";

export default async function SignUpSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <>
      <AuthHeader eyebrow="Verify" title="Check your inbox.">
        {email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="font-mono text-[14px] tracking-[0.02em] text-text-primary">
              {email}
            </span>
            . Open it and the account is live.
          </>
        ) : (
          "We sent a confirmation link. Open it and the account is live."
        )}
      </AuthHeader>

      <ul className="flex flex-wrap gap-x-3 gap-y-2 border-y border-hairline py-6 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
        {["Link valid 60 min", "One click, no code", "Check spam if it stalls"].map(
          (line, index) => (
            <li key={line} className="flex items-center gap-3">
              {index > 0 && (
                <span aria-hidden className="text-hairline">
                  /
                </span>
              )}
              {line}
            </li>
          ),
        )}
      </ul>

      <AuthNote href="/auth/login" action="Sign in">
        Confirmed already
      </AuthNote>
    </>
  );
}
