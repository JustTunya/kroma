import { PinPad } from "@/components/dashboard/PinPad";
import { roster } from "@/lib/staff";

// The roster changes when the owner hires someone; never worth a cache.
export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  return <PinPad roster={await roster()} />;
}
