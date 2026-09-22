// scripts/seed-demo.mjs
//
// pnpm seed:demo — idempotent. Run once locally after `supabase start`, or
// once against a hosted project to provision + backfill the public demo.
// Re-running is safe: staff bootstrap upserts, history generation skips
// itself once any order exists (see seedHistory in this same file).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD;
const DEMO_PIN = process.env.NEXT_PUBLIC_DEMO_STAFF_PIN;

function requireEnv() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
    ["NEXT_PUBLIC_DEMO_STAFF_EMAIL", DEMO_EMAIL],
    ["NEXT_PUBLIC_DEMO_STAFF_PASSWORD", DEMO_PASSWORD],
    ["NEXT_PUBLIC_DEMO_STAFF_PIN", DEMO_PIN],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

export async function ensureDemoStaff(client) {
  const { data: existing } = await client
    .from("staff")
    .select("id, user_id")
    .eq("is_demo", true)
    .maybeSingle();

  let userId = existing?.user_id;

  if (userId) {
    // Keep the Auth password in sync with whatever the env now says —
    // cheap, and means rotating the published password is a one-command fix.
    const { error } = await client.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
    });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
  } else {
    try {
      const { data, error } = await client.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser failed: ${error.message}`);
      userId = data.user.id;
    } catch (createErr) {
      // If createUser failed with a duplicate-email error, a previous run may have
      // created the Auth user but crashed before linking it to a staff row. Recover
      // by finding the existing user and continuing to the RPC link step.
      const { data: users, error: listErr } = await client.auth.admin.listUsers({
        limit: 1000,
      });
      if (listErr) throw createErr; // If listing fails, rethrow the original error.
      const existingUser = users?.find((u) => u.email === DEMO_EMAIL);
      if (existingUser) {
        userId = existingUser.id;
        console.log(`Recovered from partial run: found existing Auth user ${DEMO_EMAIL}`);
      } else {
        // User not found in Auth — createUser failed for a different reason, not duplicate email.
        throw createErr;
      }
    }
  }

  const { data: staffRow, error: staffError } = await client.rpc(
    "admin_upsert_demo_staff",
    { p_user_id: userId, p_pin: DEMO_PIN },
  );
  if (staffError) throw new Error(`admin_upsert_demo_staff failed: ${staffError.message}`);

  console.log(`Demo staff ready: ${DEMO_EMAIL} / PIN ${DEMO_PIN} (staff id ${staffRow.id})`);
  return { id: staffRow.id };
}

async function main() {
  requireEnv();
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const demoStaff = await ensureDemoStaff(client);
  console.log(`demoStaff ready: ${demoStaff.id}`);
  // Task 5 appends seedHistory() below this line and adds the call here —
  // it does not exist yet, so main() does not call it in this task.
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
