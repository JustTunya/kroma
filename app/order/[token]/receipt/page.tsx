import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/checkout/PrintButton";
import { receiptText, type Receipt } from "@/lib/receipt";
import { createClient } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt — KROMA" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHOP_NAME = "KROMA Coffee & Bakehouse";
const SHOP_ADDRESS = "Str. Universității 12, Cluj-Napoca, Romania";
const SHOP_VAT_ID = process.env.NEXT_PUBLIC_SHOP_VAT_ID ?? "RO00000000";

const TENDER_WORD: Record<string, string> = {
  cash: "Cash",
  card: "Card at the bar",
  online: "Paid online",
};

const money = (n: number) => `€${n.toFixed(2)}`;

// Serrated top+bottom edges, like a stub torn off a till roll. Depth is a
// fixed px amount via calc() so the notches read the same at any height.
function paperEdge(teeth: number, depthPx: number): string {
  const top: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x}% ${i % 2 === 0 ? "0px" : `${depthPx}px`}`);
  }
  const bottom: string[] = [];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    bottom.push(`${x}% ${i % 2 === 0 ? "100%" : `calc(100% - ${depthPx}px)`}`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

const PAPER_EDGE = paperEdge(20, 6);

// Code 39: each char is 5 bars + 4 spaces, alternating starting with a bar.
// '1' = wide element (3 units), '0' = narrow (1 unit). Only the digits and
// "-" we actually use, plus the "*" start/stop guard, are defined.
const CODE39: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  "-": "010000101",
  "*": "010010100",
};

function code39Bars(value: string): { bars: { x: number; w: number }[]; width: number } {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const chars = `*${value}*`;
  for (let c = 0; c < chars.length; c++) {
    const pattern = CODE39[chars[c]];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === "1" ? 3 : 1;
      if (i % 2 === 0) bars.push({ x, w }); // even index = bar, odd = space
      x += w;
    }
    if (c < chars.length - 1) x += 1; // inter-character gap
  }
  return { bars, width: x };
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("order_receipt", { p_token: token });
  if (!data) notFound();

  const receipt = data as unknown as Receipt;
  const paid = Boolean(receipt.settled_as);
  const vatRate = receipt.items[0]?.vat_rate ?? 0.11;

  // Till-roll reference number: YYMMDD-### (date + day's order sequence),
  // the way a POS prints a lookup code on a non-fiscal order stub.
  const placedAt = new Date(receipt.placed_at);
  const barcodeValue = `${String(placedAt.getFullYear()).slice(2)}${String(placedAt.getMonth() + 1).padStart(2, "0")}${String(placedAt.getDate()).padStart(2, "0")}-${String(receipt.day_number ?? 0).padStart(3, "0")}`;
  const barcode = code39Bars(barcodeValue);

  return (
    <main className="h-dvh overflow-hidden bg-surface-canvas print:block print:h-auto print:overflow-visible">
      <div className="flex h-full flex-col items-center justify-center px-4 py-4 print:hidden sm:px-5 sm:py-6">
        <div className="flex w-full max-w-[380px] shrink-0 items-center justify-between pb-3">
          <Link
            href={`/order/${token}`}
            className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            <span aria-hidden>← </span>Your order
          </Link>
          <PrintButton />
        </div>

        <div
          className="flex min-h-0 w-full max-w-[380px] max-h-full flex-col bg-surface-card px-7 pt-9 pb-6 shadow-float"
          style={{ clipPath: PAPER_EDGE }}
        >
          <header className="shrink-0 text-center">
            <p className="font-serif text-[24px] leading-none text-text-primary italic">
              {SHOP_NAME}
            </p>
            <p className="mt-3 font-mono text-[9px] tracking-[0.14em] text-text-tertiary uppercase">
              {SHOP_ADDRESS}
            </p>
            <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-text-tertiary uppercase">
              VAT {SHOP_VAT_ID}
            </p>
          </header>

          <div className="mt-6 shrink-0 border-t border-dashed border-hairline pt-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12px] font-medium tracking-[0.02em] text-text-primary">
                Order #{String(receipt.day_number ?? "").padStart(3, "0")}
              </span>
              <span className="font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
                {new Date(receipt.placed_at).toLocaleString("en-GB")}
              </span>
            </div>
            <p
              className={`mt-1.5 font-mono text-[10px] tracking-[0.12em] uppercase ${
                paid ? "text-text-secondary" : "font-medium text-badge-alert"
              }`}
            >
              {paid ? TENDER_WORD[receipt.settled_as as string] : "Not paid yet"}
            </p>
          </div>

          <ul
            className="scrollbar-hide mt-5 shrink-0 divide-y divide-hairline overflow-y-auto border-y border-dashed border-hairline"
            style={{ maxHeight: "calc(100dvh - 37.5rem)" }}
          >
            {receipt.items.map((item, i) => (
              <li key={i} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[12px] tracking-[0.02em] text-text-primary">
                    {item.quantity} × {item.item_name}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-text-primary">
                    {money(item.line_total)}
                  </span>
                </div>
                {item.selected_modifiers.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {item.selected_modifiers.map((modifier, j) => (
                      <li
                        key={j}
                        className="font-mono text-[10px] tracking-[0.08em] text-text-tertiary uppercase"
                      >
                        + {modifier.option}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-5 shrink-0 space-y-2">
            <div className="flex items-baseline justify-between font-mono text-[11px] text-text-secondary">
              <span className="tracking-[0.1em] uppercase">Subtotal</span>
              <span className="tabular-nums">{money(receipt.subtotal)}</span>
            </div>

            {receipt.discount_total > 0 && (
              <div>
                <div className="flex items-baseline justify-between font-mono text-[11px] text-badge-alert">
                  <span className="tracking-[0.1em] uppercase">Discount</span>
                  <span className="tabular-nums">
                    −{money(receipt.discount_total)}
                  </span>
                </div>
                {receipt.discount_reason && (
                  <p className="mt-0.5 font-mono text-[9px] tracking-[0.08em] text-text-tertiary uppercase">
                    {receipt.discount_reason}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-baseline justify-between font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
              <span>Incl. VAT {Math.round(vatRate * 100)}%</span>
              <span className="tabular-nums">{money(receipt.tax_total)}</span>
            </div>
          </div>

          <div className="mt-4 flex shrink-0 items-baseline justify-between border-t-2 border-text-primary pt-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-text-secondary uppercase">
              Total
            </span>
            <span className="font-serif text-[38px] leading-none text-text-primary">
              {money(receipt.total)}
            </span>
          </div>

          <div className="mt-6 shrink-0 text-center">
            <svg
              viewBox={`0 0 ${barcode.width} 34`}
              className="mx-auto h-9"
              style={{ width: barcode.width * 1.6 }}
              role="img"
              aria-label={`Reference ${barcodeValue}`}
            >
              {barcode.bars.map((bar, i) => (
                <rect key={i} x={bar.x} y={0} width={bar.w} height={34} fill="#1A1816" />
              ))}
            </svg>
            <p className="mt-1.5 font-mono text-[10px] tracking-[0.25em] text-text-tertiary">
              {barcodeValue}
            </p>
          </div>

          <footer className="mt-4 shrink-0 text-center">
            <p className="font-serif text-[17px] text-text-primary italic">
              Thank you.
            </p>
            <p className="mt-2 font-mono text-[8px] leading-snug tracking-[0.06em] text-text-tertiary uppercase">
              This is a commercial receipt, not a fiscal one.
            </p>
          </footer>
        </div>
      </div>

      {/* Printed on a thermal roll — plain fixed-width text, no layout. */}
      <pre className="hidden font-mono text-[12px] leading-[1.7] whitespace-pre text-text-primary print:block">
        {receiptText(receipt)}
      </pre>
    </main>
  );
}
