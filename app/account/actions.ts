"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { admin } from "@/lib/admin";
import { ALLERGENS, DIETS } from "@/lib/dietary";
import { createClient } from "@/lib/server";

export type ActionResult = { ok: boolean; message?: string };

const SIGN_IN: ActionResult = { ok: false, message: "Sign in first." };
const SAVED: ActionResult = { ok: true, message: "Saved." };

function pick(formData: FormData, field: string, allowed: readonly string[]): string[] {
  return formData
    .getAll(field)
    .map(String)
    .filter((value) => allowed.includes(value));
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveProfile(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return SIGN_IN;

  const name = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const barName = String(formData.get("bar_name") ?? "").trim().slice(0, 40);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 32);

  if (phone && !/^[+0-9 ()-]{6,32}$/.test(phone)) {
    return { ok: false, message: "That phone number does not look right." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: name || null,
    bar_name: barName || null,
    phone: phone || null,
  });

  if (error) {
    console.error("profile save failed:", error.message);
    return { ok: false, message: "That did not save. Try again." };
  }

  revalidatePath("/account", "layout");
  revalidatePath("/checkout");
  return SAVED;
}

export async function saveDiet(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return SIGN_IN;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    dietary_tags: pick(formData, "dietary_tags", DIETS),
    avoid_allergens: pick(formData, "avoid_allergens", ALLERGENS),
  });

  if (error) {
    console.error("diet save failed:", error.message);
    return { ok: false, message: "That did not save. Try again." };
  }

  revalidatePath("/account/settings");
  revalidatePath("/checkout");
  return SAVED;
}

export async function savePreferences(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return SIGN_IN;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });

  if (error) {
    console.error("preferences save failed:", error.message);
    return { ok: false, message: "That did not save. Try again." };
  }

  revalidatePath("/account/settings");
  return SAVED;
}

export async function signOutEverywhere(): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return SIGN_IN;

  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    console.error("global sign out failed:", error.message);
    return { ok: false, message: "Those sessions could not be ended." };
  }

  redirect("/");
}

export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  if (String(formData.get("confirm")) !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }

  const { supabase, user } = await currentUser();
  if (!user) return SIGN_IN;

  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete failed:", error.message);
    return { ok: false, message: "The account could not be deleted." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
