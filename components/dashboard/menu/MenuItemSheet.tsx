"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { deleteItemAction, saveItemAction } from "@/app/dashboard/menu/actions";
import { ALLERGENS, DIETS } from "@/lib/dietary";
import { slugify, validModifiers, type DraftItem } from "@/lib/menu-admin";
import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEscapeClose } from "@/lib/use-escape-close";
import { ModifierEditor } from "@/components/dashboard/menu/ModifierEditor";

const LABEL =
  "font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase";

const FIELD =
  "mt-2 h-10 w-full border-b border-kds-border bg-transparent font-mono text-[15px] tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary";

type Category = { id: string; name: string };

export function MenuItemSheet({
  draft: initial,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: DraftItem | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  // No effect to reset these when `initial` changes: the parent remounts
  // this component with a fresh key per item (see MenuAdminList), which
  // resets local state for free and is the state React itself recommends
  // over syncing a prop into state by hand.
  const [draft, setDraft] = useState<DraftItem | null>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEscapeClose(Boolean(initial && draft), onClose);

  if (!initial || !draft) return null;

  const nameValid = draft.name.trim().length > 0;
  const modifiersValid = validModifiers(draft.modifiers);
  const canSave = nameValid && modifiersValid && draft.categoryId;

  function patch(fields: Partial<DraftItem>) {
    setDraft((current) => (current ? { ...current, ...fields } : current));
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function save() {
    if (!draft || !canSave) return;
    setError(null);
    startTransition(async () => {
      const result = await saveItemAction(draft);
      if (result.ok) {
        onSaved();
      } else {
        setError(result.error ?? "That did not go through.");
      }
    });
  }

  function remove() {
    if (!draft?.id) return;
    if (!window.confirm(`Remove ${draft.name || "this item"} from the menu? This can't be undone.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteItemAction(draft.id!);
      if (result.ok) {
        onDeleted();
      } else {
        setError(result.error ?? "That did not go through.");
      }
    });
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-stretch justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          aria-hidden
          className="absolute inset-0 bg-text-primary/25 backdrop-blur-sm"
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={draft.id ? "Edit item" : "New item"}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={spring}
          className="relative flex h-full w-full max-w-full flex-col overflow-y-auto bg-kds-canvas sm:w-120"
        >
          <div className="flex items-center justify-between gap-4 border-b border-kds-border p-6">
            <h2 className="font-serif text-[24px] leading-[1.05] tracking-[-0.02em]">
              {draft.id ? "Edit item" : "New item"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 space-y-8 p-6">
            <label className="block">
              <span className={LABEL}>Name</span>
              <input
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  patch(slugTouched ? { name } : { name, slug: slugify(name) });
                }}
                placeholder="Cortado"
                className={FIELD}
              />
            </label>

            <label className="block">
              <span className={LABEL}>Slug</span>
              <input
                value={draft.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  patch({ slug: event.target.value });
                }}
                className={FIELD}
              />
            </label>

            <label className="block">
              <span className={LABEL}>Category</span>
              <select
                value={draft.categoryId}
                onChange={(event) => patch({ categoryId: event.target.value })}
                className={cn(FIELD, "appearance-none")}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={LABEL}>
                Price
                {initial && draft.basePrice !== initial.basePrice && (
                  <span className="ml-4 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase tabular-nums">
                    €{initial.basePrice.toFixed(2)} → €{draft.basePrice.toFixed(2)}
                  </span>
                )}
              </span>
              <input
                type="number"
                step="0.10"
                min={0}
                value={draft.basePrice}
                onChange={(event) => patch({ basePrice: event.target.valueAsNumber || 0 })}
                className={FIELD}
              />
            </label>

            <label className="block">
              <span className={LABEL}>Par stock</span>
              <input
                type="number"
                min={0}
                value={Number.isInteger(draft.parStock) ? draft.parStock! : ""}
                onChange={(event) =>
                  patch({
                    parStock: Number.isInteger(event.target.valueAsNumber)
                      ? event.target.valueAsNumber
                      : null,
                  })
                }
                placeholder="Blank"
                className={FIELD}
              />
              <p className="mt-2 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                Blank means unlimited — the espresso bar.
              </p>
            </label>

            <label className="block">
              <span className={LABEL}>Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                rows={3}
                className="mt-2 w-full resize-none border-b border-kds-border bg-transparent text-[15px] leading-[1.6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              />
            </label>

            <div>
              <span className={LABEL}>Diets</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {DIETS.map((diet) => (
                  <button
                    key={diet}
                    type="button"
                    aria-pressed={draft.dietaryTags.includes(diet)}
                    onClick={() => patch({ dietaryTags: toggle(draft.dietaryTags, diet) })}
                    className={cn(
                      "h-9 rounded-full border px-4 font-mono text-[10px] font-medium tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                      draft.dietaryTags.includes(diet)
                        ? "border-kds-text-primary bg-kds-text-primary text-kds-canvas"
                        : "border-kds-border text-kds-text-secondary",
                    )}
                  >
                    {diet}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={LABEL}>Allergens</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {ALLERGENS.map((allergen) => (
                  <button
                    key={allergen}
                    type="button"
                    aria-pressed={draft.allergens.includes(allergen)}
                    onClick={() => patch({ allergens: toggle(draft.allergens, allergen) })}
                    className={cn(
                      "h-9 rounded-full border px-4 font-mono text-[10px] font-medium tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                      draft.allergens.includes(allergen)
                        ? "border-badge-alert bg-badge-alert text-kds-canvas"
                        : "border-kds-border text-kds-text-secondary",
                    )}
                  >
                    {allergen}
                  </button>
                ))}
              </div>
            </div>

            <ModifierEditor
              groups={draft.modifiers}
              onChange={(modifiers) => patch({ modifiers })}
            />

            <button
              type="button"
              aria-pressed={draft.isActive}
              onClick={() => patch({ isActive: !draft.isActive })}
              className={cn(
                "flex h-10 w-full items-center justify-center rounded-full border font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                draft.isActive
                  ? "border-kds-text-primary bg-kds-text-primary text-kds-canvas"
                  : "border-kds-border text-kds-text-secondary",
              )}
            >
              {draft.isActive ? "On the menu" : "Off the menu"}
            </button>

            {draft.id && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="flex h-10 w-full items-center justify-center rounded-full border border-badge-alert font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase transition-colors hover:bg-badge-alert hover:text-kds-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:opacity-40"
              >
                Remove item
              </button>
            )}
          </div>

          <div className="border-t border-kds-border p-6">
            {!canSave && (
              <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
                {!nameValid ? "Needs a name." : "That modifier group is not shaped right."}
              </p>
            )}
            {error && (
              <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
                {error}
              </p>
            )}
            <motion.button
              type="button"
              onClick={save}
              disabled={!canSave || pending}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="flex h-10 w-full items-center justify-center rounded-full bg-accent-primary font-mono text-[11px] font-medium tracking-[0.14em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {pending ? "Saving" : "Save"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
