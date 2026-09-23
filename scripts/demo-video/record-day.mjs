import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const CONFIG = {
  loginUrl: "http://localhost:3000/auth/login",
  dayUrl: "http://localhost:3000/dashboard/day",
  viewport: { width: 1920, height: 1080 },
  outDir: "scripts/demo-video/out",
  targetDurationS: 5.0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Launching Headed Chromium ===");
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--hide-scrollbars",
      "--disable-features=OverlayScrollbar",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: {
      dir: CONFIG.outDir,
      size: CONFIG.viewport,
    },
  });

  const page = await context.newPage();
  const videoStartTime = Date.now();

  // Inject CSS to ensure instant linear scrolling and hidden scrollbars
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      *, html, body {
        scroll-behavior: auto !important;
      }
      html, body {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.documentElement.appendChild(style);
  });

  console.log("1. Logging in via /auth/login...");
  await page.goto(CONFIG.loginUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Try the staff side/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  if (page.url().includes("/unlock")) {
    console.log("Unlocking staff with PIN 4242...");
    await page.locator("ul li button").first().click();
    for (const digit of ["4", "2", "4", "2"]) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(100);
    }
    await page.waitForURL("**/dashboard/board**", { timeout: 10000 });
  }

  console.log("2. Navigating to /dashboard/day...");
  await page.goto(CONFIG.dayUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  if (page.url().includes("/unlock")) {
    console.log("Unlocking on day page...");
    await page.locator("ul li button").first().click();
    for (const digit of ["4", "2", "4", "2"]) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(100);
    }
    await page.waitForURL("**/dashboard/board**", { timeout: 10000 });
    await page.goto(CONFIG.dayUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
  }

  await sleep(1500); // Settle page layout

  // Reset to absolute top
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await sleep(500);

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const innerHeight = await page.evaluate(() => window.innerHeight);
  const maxScrollY = Math.max(0, scrollHeight - innerHeight);

  console.log(`Page scrollable height: ${maxScrollY}px (total ${scrollHeight}px).`);

  const tStartS = (Date.now() - videoStartTime) / 1000;
  console.log(`Scroll start timestamp: ${tStartS.toFixed(3)}s`);

  if (maxScrollY > 0) {
    const durationMs = CONFIG.targetDurationS * 1000;
    // Pure linear scroll over 5 seconds
    await page.evaluate(
      ([targetY, duration]) => {
        return new Promise((resolve) => {
          let start = null;
          function step(now) {
            if (!start) start = now;
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const y = targetY * progress;

            window.scrollTo({ top: y, left: 0, behavior: "instant" });
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
              document.documentElement.scrollTop = targetY;
              document.body.scrollTop = targetY;
              resolve(undefined);
            }
          }
          requestAnimationFrame(step);
        });
      },
      [maxScrollY, durationMs]
    );
  } else {
    // If page fits within single screen, hold static for duration
    await sleep(CONFIG.targetDurationS * 1000);
  }

  const tEndS = (Date.now() - videoStartTime) / 1000;
  console.log(`Scroll end timestamp: ${tEndS.toFixed(3)}s`);

  await sleep(500);

  console.log("Finalizing raw video...");
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  console.log("Raw video recorded to:", rawPath);

  const finalMp4 = path.join(CONFIG.outDir, "kroma-day-demo.mp4");

  console.log(`=== Encoding 5s Linear MP4 (${tStartS.toFixed(2)}s -> ${tEndS.toFixed(2)}s) ===`);
  const ffmpegCmd = `ffmpeg -y -i "${rawPath}" -vf "trim=start=${tStartS.toFixed(2)}:end=${tEndS.toFixed(2)},setpts=PTS-STARTPTS,scale=1280:720,fps=30" -an -movflags +faststart -c:v libx264 -preset veryslow -crf 20 -pix_fmt yuv420p "${finalMp4}"`;
  execSync(ffmpegCmd, { stdio: "inherit" });

  await unlink(rawPath).catch(() => {});
  console.log(`\nDONE: ${finalMp4}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Recording failed:", err);
  process.exit(1);
});
