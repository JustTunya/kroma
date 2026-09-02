
import { cookies } from "next/headers";

import { ACTOR_COOKIE, ACTOR_TTL_MS, actorSecret, signActor } from "@/lib/staff-session";

import type { StaffRole } from "@/lib/staff-permissions";

export type Result = { ok: boolean; error?: string };

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

  path: "/dashboard",
  maxAge: ACTOR_TTL_MS / 1000,
} as const;

export async function slide(actor: { staffId: string; role: StaffRole; name: string }) {
  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor({ ...actor, exp: Date.now() + ACTOR_TTL_MS }, actorSecret()),
    COOKIE_OPTIONS,
  );
}
