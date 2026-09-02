"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { ALLERGENS, DIETS, passLine } from "@/lib/dietary";
import { numberTransition, pressSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/app/account/actions";

type Action = (formData: FormData) => Promise<ActionResult>;

const LABEL =
  "block font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase";

const FIELD =
  "mt-2 h-11 w-full max-w-sm border-b border-hairline bg-transparent font-mono text-[15px] tracking-[0.02em] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

const HINT = "mt-2 block max-w-sm text-[13px] leading-[1.55] text-text-tertiary";

function useAction(action: Action) {
  return useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );
}

function Result({ state }: { state: ActionResult | null }) {
  return (
    <span aria-live="polite" className="block min-h-5">
      {}
      <AnimatePresence mode="wait" initial={false}>
        {state?.message && (
          <motion.span
            key={state.message}
            {...numberTransition}
            className={cn(
              "block font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
              state.ok ? "text-badge-live" : "text-badge-alert",
            )}
          >
            {state.message}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Save({ pending, children = "Save" }: { pending: boolean; children?: React.ReactNode }) {
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      className="flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] text-surface-card uppercase transition-colors duration-300 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:bg-surface-muted disabled:text-text-tertiary"
    >
      {pending ? "Saving" : children}
    </motion.button>
  );
}

function Commit({ pending, state, label }: { pending: boolean; state: ActionResult | null; label?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
      <Save pending={pending}>{label}</Save>
      <Result state={state} />
    </div>
  );
}

function TogglePill({
  name,
  value,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <motion.label
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      className="flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-surface-muted px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap text-text-tertiary uppercase transition-colors duration-300 hover:text-text-primary has-[:checked]:bg-text-primary has-[:checked]:text-surface-canvas has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus"
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {value}
    </motion.label>
  );
}

export function ProfileForm({
  action,
  displayName,
  barName,
  phone,
}: {
  action: Action;
  displayName: string;
  barName: string;
  phone: string;
}) {
  const [state, formAction, pending] = useAction(action);

  const [fields, setFields] = useState({
    display_name: displayName,
    bar_name: barName,
    phone,
  });

  const set = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form action={formAction}>
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-x-12">
        <label className="block">
          <span className={LABEL}>Your name</span>
          <input
            name="display_name"
            value={fields.display_name}
            onChange={set("display_name")}
            maxLength={80}
            autoComplete="name"
            placeholder="Who the account belongs to"
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Name at the bar</span>
          <input
            name="bar_name"
            value={fields.bar_name}
            onChange={set("bar_name")}
            maxLength={40}
            placeholder="What gets called out"
            className={FIELD}
          />
          <span className={HINT}>
            Left empty, we use your name. This is the one that lands on the ticket.
          </span>
        </label>

        <label className="block">
          <span className={LABEL}>Phone</span>
          <input
            name="phone"
            type="tel"
            value={fields.phone}
            onChange={set("phone")}
            maxLength={32}
            autoComplete="tel"
            placeholder="Optional"
            className={FIELD}
          />
          <span className={HINT}>Only used if something on your order needs a word.</span>
        </label>
      </div>

      <Commit pending={pending} state={state} />
    </form>
  );
}

function useTagSet(initial: string[]) {
  const [tags, setTags] = useState(() => new Set(initial));
  return {
    has: (tag: string) => tags.has(tag),
    toggle: (tag: string, on: boolean) =>
      setTags((current) => {
        const next = new Set(current);
        if (on) next.add(tag);
        else next.delete(tag);
        return next;
      }),
    list: [...tags],
  };
}

export function DietForm({
  action,
  diets,
  avoid,
}: {
  action: Action;
  diets: string[];
  avoid: string[];
}) {
  const [state, formAction, pending] = useAction(action);
  const diet = useTagSet(diets);
  const allergen = useTagSet(avoid);

  const ticket = passLine({ diets: diet.list, avoid: allergen.list });

  return (
    <form action={formAction}>
      <fieldset>
        <legend className={LABEL}>Diet</legend>
        <p className={HINT}>Only things carrying the claim count as a match.</p>
        <div className="scrollbar-hide mt-4 flex flex-wrap gap-1.5">
          {DIETS.map((tag) => (
            <TogglePill
              key={tag}
              name="dietary_tags"
              value={tag}
              checked={diet.has(tag)}
              onChange={(next) => diet.toggle(tag, next)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className={LABEL}>Avoid</legend>
        <p className={HINT}>
          Anything listing one of these gets flagged before you pay. Swapped milk and
          gluten-free bread are counted as ordered.
        </p>
        <div className="scrollbar-hide mt-4 flex flex-wrap gap-1.5">
          {ALLERGENS.map((tag) => (
            <TogglePill
              key={tag}
              name="avoid_allergens"
              value={tag}
              checked={allergen.has(tag)}
              onChange={(next) => allergen.toggle(tag, next)}
            />
          ))}
        </div>
      </fieldset>

      {}
      <p
        role="status"
        className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-hairline py-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase"
      >
        <span className="text-accent-primary">On your ticket</span>
        <span aria-hidden className="text-hairline">
          /
        </span>
        {ticket.length === 0 ? (
          <span className="text-text-tertiary">Nothing flagged</span>
        ) : (
          ticket.map((entry, index) => (
            <span key={entry} className="flex items-center gap-3 text-text-primary">
              {index > 0 && (
                <span aria-hidden className="text-hairline">
                  /
                </span>
              )}
              {entry}
            </span>
          ))
        )}
      </p>

      <Commit pending={pending} state={state} />
    </form>
  );
}

export function PreferencesForm({
  action,
  marketingOptIn,
}: {
  action: Action;
  marketingOptIn: boolean;
}) {
  const [state, formAction, pending] = useAction(action);

  const [on, setOn] = useState(marketingOptIn);

  return (
    <form action={formAction}>
      <label className="flex cursor-pointer items-baseline justify-between gap-6 border-y border-hairline py-5">
        <span>
          <span className="block font-mono text-[13px] tracking-[0.02em] text-text-primary">
            Seasonal notes
          </span>
          <span className="mt-1 block max-w-md text-[13px] leading-[1.55] text-text-tertiary">
            New crop, new bake, roughly once a month. Order updates always send —
            they are how you know a drink is ready.
          </span>
        </span>
        <input
          type="checkbox"
          name="marketing_opt_in"
          checked={on}
          disabled={pending}
          onChange={(event) => {
            setOn(event.target.checked);
            event.currentTarget.form?.requestSubmit();
          }}
          className="size-4 shrink-0 accent-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        />
      </label>

      <div className="mt-4">
        <Result state={state} />
      </div>
    </form>
  );
}

export function SignOutEverywhereForm({ action }: { action: () => Promise<ActionResult> }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    () => action(),
    null,
  );

  return (
    <form action={formAction} className="mt-6">
      <p className="max-w-md text-[15px] leading-[1.55] text-text-secondary">
        Ends every session on every device, including this one. Use it if you signed
        in somewhere you do not own.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className="flex h-10 items-center rounded-full bg-surface-muted px-5 font-mono text-[11px] font-medium tracking-[0.14em] text-text-primary uppercase transition-colors duration-300 hover:bg-border-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary"
        >
          {pending ? "Ending sessions" : "Sign out everywhere"}
        </motion.button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function DeleteAccountForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useAction(action);
  const [confirm, setConfirm] = useState("");

  return (
    <form action={formAction} className="mt-6">
      <p className="max-w-md text-[15px] leading-[1.55] text-text-secondary">
        This removes your account, your card and your saved items. Past orders stay on
        the bakehouse&rsquo;s books without your name on them. It cannot be undone.
      </p>

      <label className="mt-8 block max-w-sm">
        <span className={LABEL}>Type DELETE to confirm</span>
        <input
          name="confirm"
          autoComplete="off"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={FIELD}
        />
      </label>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <motion.button
          type="submit"
          disabled={pending || confirm !== "DELETE"}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className="flex h-10 items-center rounded-full border border-badge-alert px-5 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase transition-colors duration-300 hover:bg-badge-alert hover:text-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:border-border-subtle disabled:text-text-tertiary disabled:hover:bg-transparent disabled:hover:text-text-tertiary"
        >
          {pending ? "Deleting" : "Delete account"}
        </motion.button>
        <Result state={state} />
      </div>
    </form>
  );
}
