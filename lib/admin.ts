import "server-only";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Service-role client. Bypasses every RLS policy, so it is imported ONLY by the
 * Stripe webhook and the cron route — the two places with no user session that
 * still have to write.
 */
export function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
