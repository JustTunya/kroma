import { createClient } from "@/lib/client";
import type { CartLine } from "@/lib/cart";

export async function readServerCart(): Promise<CartLine[]> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return (data?.items as CartLine[] | undefined) ?? [];
}

export async function writeServerCart(lines: CartLine[]): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { error } = await supabase
    .from("carts")
    .upsert({ user_id: auth.user.id, items: lines }, { onConflict: "user_id" });

  if (error) throw error;
}
