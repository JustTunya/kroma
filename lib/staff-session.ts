import { createHmac, timingSafeEqual } from "node:crypto";

import type { StaffRole } from "@/lib/staff-permissions";

export const ACTOR_COOKIE = "kroma_actor";
export const ACTOR_TTL_MS = 15 * 60 * 1000;

export type ActorPayload = {
  staffId: string;
  role: StaffRole;
  name: string;

  exp: number;
};

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signActor(payload: ActorPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readActor(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): ActorPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, given] = parts;

  const expected = sign(body, secret);

  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as ActorPayload;

    if (typeof payload.exp !== "number" || payload.exp <= now.getTime()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function actorSecret(): string {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) throw new Error("STAFF_SESSION_SECRET is not set");
  return secret;
}
