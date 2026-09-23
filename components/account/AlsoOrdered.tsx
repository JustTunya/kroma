import Image from "next/image";

import { ReorderButton } from "@/components/account/ReorderButton";
import type { CartLine } from "@/lib/cart";

export type Also = {
  id: string;
  name: string;
  price: number;
  spec: string[];
  imageUrl: string;
  soldOut: boolean;
  lines: CartLine[];
};

export function AlsoOrdered({ items }: { items: Also[] }) {
  return (
    <section
      aria-labelledby="also-h"
      className="border-b border-hairline px-5 py-14 sm:px-10 lg:px-14 lg:py-20"
    >
      <h2
        id="also-h"
        className="font-mono text-[11px] font-medium tracking-[0.18em] text-text-secondary uppercase"
      >
        Also ordered
      </h2>

      <ul className="mt-8 divide-y divide-hairline border-y border-hairline">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-5 sm:flex-nowrap">
            <div
              className={`relative size-16 shrink-0 overflow-hidden rounded-sm border border-border-subtle bg-surface-muted ${
                item.soldOut ? "grayscale" : ""
              }`}
            >
              <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            </div>

            <div className="min-w-0 flex-1 basis-40">
              <h3
                className={`font-serif text-[clamp(22px,2.2vw,28px)] leading-[1.1] tracking-[-0.02em] ${
                  item.soldOut ? "text-text-tertiary" : "text-text-primary"
                }`}
              >
                {item.name}
              </h3>
              <p className="mt-1.5 font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase">
                {[...item.spec, ...(item.soldOut ? ["Gone for today"] : [])].join(" / ")}
              </p>
            </div>

            <span className="font-mono text-[15px] font-medium tabular-nums text-text-primary">
              €{item.price.toFixed(2)}
            </span>
            <ReorderButton lines={item.lines} variant="inline" />
          </li>
        ))}
      </ul>
    </section>
  );
}
