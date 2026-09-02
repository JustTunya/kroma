import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

import { shopDayKey } from "@/lib/manage";
import { createClient } from "@/lib/server";
import { staffCan } from "@/lib/staff-permissions";
import { ACTOR_COOKIE, actorSecret, readActor } from "@/lib/staff-session";

import type { ServiceDay } from "@/lib/service-day";
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

export async function currentStaff(): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_staff").maybeSingle();
  return (data as StaffRow | null) ?? null;
}

export async function currentActor(): Promise<ActorPayload | null> {
  const store = await cookies();
  return readActor(store.get(ACTOR_COOKIE)?.value, actorSecret());
}

export async function requireActor(action: StaffAction): Promise<ActorPayload> {
  const actor = await currentActor();
  if (!actor) throw new Error("Unlock with your PIN first.");
  if (!staffCan(actor.role, action)) throw new Error("Not yours to do.");
  return actor;
}

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

export const currentShift = cache(async (): Promise<string | null> => {
  const actor = await currentActor();
  if (!actor) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_shift", {
    p_staff_id: actor.staffId,
  });
  return (data as string | null) ?? null;
});

export const currentDay = cache(async (): Promise<ServiceDay | null> => {
  const supabase = await createClient();
  const today = shopDayKey();
  const { data } = await supabase
    .from("service_days")
    .select("day, opened_at, opened_by, closed_at, next_number, float_cash, counted_cash")
    .eq("day", today)
    .is("closed_at", null)
    .maybeSingle();
  return (data as ServiceDay | null) ?? null;
});
