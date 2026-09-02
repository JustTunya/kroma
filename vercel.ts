import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",

  crons: [{ path: "/api/cron/release-holds", schedule: "0 3 * * *" }],
};
