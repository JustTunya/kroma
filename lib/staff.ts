import "server-only";
import { cookies } from "next/headers";

import { createClient } from "@/lib/server";
import { staffCan } from "@/lib/staff-permissions";
import { ACTOR_COOKIE, actorSecret, readActor } from "@/lib/staff-session";

import type { StaffAction, StaffRole } from "@/lib/staff-permissions";
import type { ActorPayload } from "@/lib/staff-session";

export type StaffRow = {
  id: string;
  display_name: string;
  role: StaffRole;
  kind: "person" | "station";
  station: "bar" | "kitchen";
  is_active: boolean;
};

export type RosterEntry = { id: string; display_name: string; role: StaffRole };

/**
 * The staff row behind the Supabase session — the station, or a manager on
 * their own phone. Not the actor: the actor is whoever last entered a PIN.
 */
export async function currentStaff(): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_staff").maybeSingle();
  return (data as StaffRow | null) ?? null;
}

/** Whoever unlocked the terminal, if their fifteen minutes are still running. */
export async function currentActor(): Promise<ActorPayload | null> {
  const store = await cookies();
  return readActor(store.get(ACTOR_COOKIE)?.value, actorSecret());
}

/**
 * Guard for a server action. Throws rather than returning null, because an
 * action that forgets to check would otherwise write with no actor at all.
 *
 * This is a convenience, not the security boundary: advance_order() and
 * set_item_stock() re-read the role and is_active from the database on every
 * call and do not trust this cookie.
 */
export async function requireActor(action: StaffAction): Promise<ActorPayload> {
  const actor = await currentActor();
  if (!actor) throw new Error("Unlock with your PIN first.");
  if (!staffCan(actor.role, action)) throw new Error("Not yours to do.");
  return actor;
}

/** Names for the unlock screen. A station is not a person and never appears. */
export async function roster(): Promise<RosterEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, display_name, role")
    .eq("kind", "person")
    .eq("is_active", true)
    .order("display_name");
  return (data as RosterEntry[] | null) ?? [];
}
