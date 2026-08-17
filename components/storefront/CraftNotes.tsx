"use client";

import { motion } from "framer-motion";

import { glide, inView, rise } from "@/lib/reveal";
import { cn } from "@/lib/utils";

const NOTES = [
  {
    eyebrow: "Roasting",
    title: "Tuesdays, on the drum",
    body: "We roast the week's coffee on a 12kg drum and rest it five days before it reaches the bar. Two origins rotate with the harvest. Nothing is held past its season.",
    stats: ["12 kg drum", "5 day rest", "2 origins"],
  },
  {
    eyebrow: "Fermenting",
    title: "Mixed the day before",
    body: "Dough goes together in the afternoon and ferments overnight at 4°C. It bakes at six, which is why the shelves thin out by noon — and why we don't refill them.",
    stats: ["18 h bulk", "4°C overnight", "Baked 06:00"],
  },
];

export function CraftNotes() {
  return (
    <section
      aria-label="How KROMA works"
      className="grid border-t border-hairline md:grid-cols-2"
    >
      {NOTES.map((note, index) => (
        <motion.article
          key={note.eyebrow}
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className={cn(
            "px-5 py-16 sm:px-10 lg:px-14 lg:py-24",
            index > 0 && "border-t border-hairline md:border-t-0 md:border-l",
          )}
        >
          <motion.p
            variants={rise}
            transition={glide}
            className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase"
          >
            {note.eyebrow}
          </motion.p>

          <motion.h2
            variants={rise}
            transition={glide}
            className="mt-6 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary"
          >
            {note.title}
          </motion.h2>

          <motion.p
            variants={rise}
            transition={glide}
            className="mt-6 max-w-md text-[16px] leading-[1.6] text-text-secondary"
          >
            {note.body}
          </motion.p>

          <motion.ul
            variants={rise}
            transition={glide}
            className="mt-10 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
          >
            {note.stats.map((stat, statIndex) => (
              <li key={stat} className="flex items-center gap-3">
                {statIndex > 0 && (
                  <span aria-hidden className="text-hairline">
                    /
                  </span>
                )}
                {stat}
              </li>
            ))}
          </motion.ul>
        </motion.article>
      ))}
    </section>
  );
}
