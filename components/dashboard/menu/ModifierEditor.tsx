"use client";

import { motion } from "framer-motion";

import { pressSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ModifierGroup } from "@/types/menu";

const LABEL =
  "font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase";

const FIELD =
  "h-9 w-full border-b border-kds-border bg-transparent font-mono text-[13px] tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary";

function newGroup(): ModifierGroup {
  return { name: "", options: [] };
}

export function ModifierEditor({
  groups,
  onChange,
}: {
  groups: ModifierGroup[];
  onChange: (groups: ModifierGroup[]) => void;
}) {
  function updateGroup(index: number, patch: Partial<ModifierGroup>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, i) => i !== index));
  }

  function addOption(groupIndex: number) {
    updateGroup(groupIndex, {
      options: [...groups[groupIndex].options, { name: "", priceOffset: 0 }],
    });
  }

  function updateOption(
    groupIndex: number,
    optionIndex: number,
    patch: Partial<{ name: string; priceOffset: number }>,
  ) {
    updateGroup(groupIndex, {
      options: groups[groupIndex].options.map((o, i) =>
        i === optionIndex ? { ...o, ...patch } : o,
      ),
    });
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    updateGroup(groupIndex, {
      options: groups[groupIndex].options.filter((_, i) => i !== optionIndex),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={LABEL}>Modifiers</span>
        <button
          type="button"
          onClick={() => onChange([...groups, newGroup()])}
          className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        >
          + Group
        </button>
      </div>

      <div className="mt-4 space-y-8">
        {groups.map((group, gi) => (
          <div key={gi} className="border-y border-kds-border py-5">
            <div className="flex items-center gap-3">
              <input
                value={group.name}
                onChange={(event) => updateGroup(gi, { name: event.target.value })}
                placeholder="Milk Choice"
                aria-label={`Group ${gi + 1} name`}
                className={cn(FIELD, "flex-1")}
              />
              <button
                type="button"
                aria-pressed={group.required ?? false}
                onClick={() => updateGroup(gi, { required: !group.required })}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3 font-mono text-[10px] font-medium tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                  group.required
                    ? "border-kds-text-primary bg-kds-text-primary text-kds-canvas"
                    : "border-kds-border text-kds-text-secondary",
                )}
              >
                Required
              </button>
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                aria-label={`Remove group ${group.name || gi + 1}`}
                className="shrink-0 font-mono text-[13px] text-kds-text-secondary transition-colors hover:text-badge-alert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {group.options.map((option, oi) => (
                <div key={oi} className="flex items-center gap-3">
                  <input
                    value={option.name}
                    onChange={(event) => updateOption(gi, oi, { name: event.target.value })}
                    placeholder="Oat Milk"
                    aria-label={`Option ${oi + 1} name`}
                    className={cn(FIELD, "flex-1")}
                  />
                  <span className="flex shrink-0 items-center gap-1">
                    <span aria-hidden className="font-mono text-[13px] text-kds-text-secondary">
                      €
                    </span>
                    <input
                      type="number"
                      step="0.10"
                      value={option.priceOffset}
                      onChange={(event) =>
                        updateOption(gi, oi, { priceOffset: event.target.valueAsNumber || 0 })
                      }
                      aria-label={`${option.name || "Option"} price offset`}
                      className={cn(FIELD, "w-20 text-right tabular-nums")}
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOption(gi, oi)}
                    aria-label={`Remove option ${option.name || oi + 1}`}
                    className="shrink-0 font-mono text-[13px] text-kds-text-secondary transition-colors hover:text-badge-alert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <motion.button
              type="button"
              onClick={() => addOption(gi)}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="mt-3 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              + Option
            </motion.button>
          </div>
        ))}
      </div>
    </div>
  );
}
