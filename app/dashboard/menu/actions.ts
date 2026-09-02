"use server";

import { revalidatePath } from "next/cache";

import { fail, slide, type Result } from "@/app/dashboard/actions";
import { createClient } from "@/lib/server";
import { requireActor } from "@/lib/staff";

import type { DraftItem } from "@/lib/menu-admin";

function afterMenuWrite() {
  revalidatePath("/dashboard/menu");
  // The storefront is on revalidate = 30, so it would self-heal within half a
  // minute. A manager who changes a price and reloads expects to see it now.
  revalidatePath("/", "page");
}

export async function saveItemAction(draft: DraftItem): Promise<Result> {
  try {
    const actor = await requireActor("menu.edit");
    const supabase = await createClient();

    const { error } = await supabase.rpc("menu_upsert", {
      p_actor: actor.staffId,
      p_item: {
        id: draft.id,
        category_id: draft.categoryId,
        name: draft.name,
        slug: draft.slug,
        description: draft.description,
        base_price: draft.basePrice,
        daily_stock: draft.dailyStock,
        par_stock: draft.parStock,
        dietary_tags: draft.dietaryTags,
        allergens: draft.allergens,
        modifiers: draft.modifiers,
        image_url: draft.imageUrl,
        is_active: draft.isActive,
      },
    });
    if (error) return fail(error);

    await slide(actor);
    afterMenuWrite();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reorderItemsAction(ids: string[]): Promise<Result> {
  try {
    const actor = await requireActor("menu.edit");
    const supabase = await createClient();

    const { error } = await supabase.rpc("menu_reorder", {
      p_actor: actor.staffId,
      p_ids: ids,
    });
    if (error) return fail(error);

    await slide(actor);
    afterMenuWrite();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveCategoryAction(category: {
  id: string | null;
  name: string;
  vatRate: number;
  earnsPunch: boolean;
  isActive: boolean;
}): Promise<Result> {
  try {
    const actor = await requireActor("menu.edit");
    const supabase = await createClient();

    const { error } = await supabase.rpc("menu_category_upsert", {
      p_actor: actor.staffId,
      p_category: {
        id: category.id,
        name: category.name,
        vat_rate: category.vatRate,
        earns_punch: category.earnsPunch,
        is_active: category.isActive,
      },
    });
    if (error) return fail(error);

    await slide(actor);
    afterMenuWrite();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
