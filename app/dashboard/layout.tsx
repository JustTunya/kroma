import { BoardStatusProvider } from "@/components/dashboard/BoardStatus";
import { StaffBar } from "@/components/dashboard/StaffBar";
import { PWARegister } from "@/components/PWARegister";
import { currentActor, currentDay, currentShift } from "@/lib/staff";
import { staffCan } from "@/lib/staff-permissions";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "The pass — KROMA",

  robots: { index: false, follow: false },
  manifest: "/manifest-kds.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KROMA KDS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#141211",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actor, shiftSince, day] = await Promise.all([
    currentActor(),
    currentShift(),
    currentDay(),
  ]);

  return (
    <div className="min-h-dvh bg-kds-canvas text-kds-text-primary">
      <PWARegister scope="/dashboard" />
      {}
      <BoardStatusProvider>
        <StaffBar
          actorName={actor?.name ?? null}
          onShift={Boolean(shiftSince)}
          canSeeNumbers={actor ? staffCan(actor.role, "analytics.view") : false}
          canEditMenu={actor ? staffCan(actor.role, "menu.edit") : false}
          dayOpenedAt={day?.opened_at ?? null}
        />
        {}
        <main className="pt-14">{children}</main>
      </BoardStatusProvider>
    </div>
  );
}
