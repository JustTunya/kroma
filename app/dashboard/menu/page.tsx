import { redirect } from "next/navigation";

import { MenuAdminList } from "@/components/dashboard/menu/MenuAdminList";
import { createClient } from "@/lib/server";
import { currentActor } from "@/lib/staff";
import { staffCan } from "@/lib/staff-permissions";

export const metadata = {
  title: "Menu — KROMA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  const actor = await currentActor();
  if (!actor) redirect("/dashboard/unlock");
  if (!staffCan(actor.role, "menu.edit")) redirect("/dashboard/board");

  const supabase = await createClient();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order"),
    supabase.from("menu_items").select("*").order("sort_order"),
  ]);

  return (
    <>
      <header className="px-5 pt-10 pb-9 sm:px-10 lg:px-14">
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Menu
        </p>
        <h1 className="mt-2 font-serif text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.02em]">
          The menu
        </h1>
      </header>

      <MenuAdminList categories={categories ?? []} items={items ?? []} />
    </>
  );
}
