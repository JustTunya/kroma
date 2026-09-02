"use client";

import { useEffect, useState } from "react";

import { setReceiptEmailAction, subscribeToOrderAction } from "@/app/order/actions";

type Support = "checking" | "push" | "granted" | "email";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function NotifyButton({ token }: { token: string }) {
  const [support, setSupport] = useState<Support>("checking");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detected: Support =
      !("serviceWorker" in navigator) || !("PushManager" in window)
        ? "email"
        : Notification.permission === "granted"
          ? "granted"
          : "push";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(detected);
  }, []);

  async function enable() {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport("email");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setSupport("email");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const result = await subscribeToOrderAction(token, subscription.toJSON() as never);
      if (!result.ok) {
        setError(result.error ?? "That did not go through.");
        setSupport("email");
        return;
      }

      setSupport("granted");
    } catch (err) {
      console.error("push subscribe failed:", err);
      setSupport("email");
    }
  }

  async function sendEmail() {
    setError(null);
    const result = await setReceiptEmailAction(token, email);
    if (result.ok) {
      setEmailSent(true);
    } else {
      setError(result.error ?? "That did not go through.");
    }
  }

  if (support === "checking") return null;

  if (support === "granted") {
    return (
      <p className="mt-5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-live uppercase">
        We&rsquo;ll ping you.
      </p>
    );
  }

  if (support === "push") {
    return (
      <>
        <button
          type="button"
          onClick={enable}
          className="mt-5 h-9 rounded-full border border-hairline px-4 font-mono text-[10px] font-medium tracking-[0.18em] text-text-primary uppercase transition-colors hover:border-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          Tell me when it&rsquo;s ready
        </button>
        {error && (
          <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase">
            {error}
          </p>
        )}
      </>
    );
  }

  if (emailSent) {
    return (
      <p className="mt-5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-live uppercase">
        We&rsquo;ll email you.
      </p>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        aria-label="Email for a ready notification"
        className="h-9 min-w-0 flex-1 border-b border-hairline bg-transparent font-mono text-[13px] tracking-[0.02em] placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      />
      <button
        type="button"
        onClick={sendEmail}
        disabled={!email.includes("@")}
        className="h-9 shrink-0 rounded-full border border-hairline px-4 font-mono text-[10px] font-medium tracking-[0.18em] text-text-primary uppercase transition-colors hover:border-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary"
      >
        Email me when it&rsquo;s ready
      </button>
      {error && (
        <p className="w-full font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase">
          {error}
        </p>
      )}
    </div>
  );
}
