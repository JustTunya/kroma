import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/checkout/PrintButton";
import { receiptText, type Receipt } from "@/lib/receipt";
import { createClient } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt — KROMA" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  return (
    <main className="min-h-dvh bg-surface-canvas px-5 py-16">
      <div className="mx-auto max-w-[380px]">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link
            href={`/order/${token}`}
            className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            <span aria-hidden>← </span>Your order
          </Link>
          <PrintButton />
        </div>

        <pre className="font-mono text-[12px] leading-[1.7] whitespace-pre text-text-primary">
          {receiptText(receipt)}
        </pre>
      </div>
    </main>
  );
}
