import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Daily backstop (Hobby plan cron limit): releases stock held by online orders
  // whose Stripe session expired without the webhook arriving.
  crons: [{ path: "/api/cron/release-holds", schedule: "0 3 * * *" }],
};
