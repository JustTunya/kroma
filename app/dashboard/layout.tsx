import { BoardStatusProvider } from "@/components/dashboard/BoardStatus";
import { StaffBar } from "@/components/dashboard/StaffBar";
import { currentActor, currentStaff } from "@/lib/staff";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The pass — KROMA",
  // Unlinked from the storefront and out of every index. Surface reduction,
  // not a security control: the boundary is RLS plus the proxy gate.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [station, actor] = await Promise.all([currentStaff(), currentActor()]);

  return (
    <div className="min-h-dvh bg-kds-canvas text-kds-text-primary">
      {/* The pill is in the header and the socket is in the page. This is what
          lets the second tell the first what it is hearing. */}
      <BoardStatusProvider>
        <StaffBar
          stationName={station?.display_name ?? "Unnamed station"}
          actorName={actor?.name ?? null}
        />
        {/* h-14, one line shorter than the storefront header: a bar screen owes
            every pixel it can to the orders. */}
        <main className="pt-14">{children}</main>
      </BoardStatusProvider>
    </div>
  );
}
