import { AuthHeader, AuthNote } from "@/components/auth/AuthForm";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <AuthHeader eyebrow="Interrupted" title="That link did not hold.">
        Confirmation and reset links are single use and expire after an hour.
        Ask for a fresh one and it will work.
      </AuthHeader>

      <p className="border-y border-hairline py-6 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase">
        {error ?? "No token hash or type"}
      </p>

      <AuthNote href="/auth/login" action="Sign in">
        Back to the bar
      </AuthNote>
    </>
  );
}
