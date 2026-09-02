/**
 * Shared by every "use server" actions file under app/dashboard/. A "use
 * server" file may only export async functions — Next.js enforces it at
 * build time — so these two live here instead of in app/dashboard/actions.ts.
 */

import { cookies } from "next/headers";

import { ACTOR_COOKIE, ACTOR_TTL_MS, actorSecret, signActor } from "@/lib/staff-session";

import type { StaffRole } from "@/lib/staff-permissions";

export type Result = { ok: boolean; error?: string };

/** Anything the RPC raises is already worded for a person. Pass it through. */
export function fail(error: unknown): Result {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return { ok: false, error: message };
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  // Scoped to the dashboard: the storefront has no business carrying it.
  path: "/dashboard",
  maxAge: ACTOR_TTL_MS / 1000,
} as const;

/** Fifteen minutes from the last thing you did, not from when you unlocked. */
export async function slide(actor: { staffId: string; role: StaffRole; name: string }) {
  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor({ ...actor, exp: Date.now() + ACTOR_TTL_MS }, actorSecret()),
    COOKIE_OPTIONS,
  );
}
