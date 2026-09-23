import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const CONFIG = {
  loginUrl: "http://localhost:3000/auth/login",
  numbersUrl: "http://localhost:3000/dashboard/numbers",
  viewport: { width: 1920, height: 1080 },
  outDir: "scripts/demo-video/out",
  targetDurationS: 5.0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Cleaning previous video files ===");
  const existingFiles = await readdir(CONFIG.outDir).catch(() => []);
  for (const f of existingFiles) {
    if (f.endsWith(".webm") || f.endsWith(".mp4")) {
      await unlink(path.join(CONFIG.outDir, f)).catch(() => {});
    }
  }

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

  // Inject CSS for instant scrolling and hidden scrollbars
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

  console.log("1. Logging in...");
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

  console.log("2. Navigating to /dashboard/numbers...");
  await page.goto(CONFIG.numbersUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  if (page.url().includes("/unlock")) {
    console.log("Unlocking on numbers page...");
    await page.locator("ul li button").first().click();
    for (const digit of ["4", "2", "4", "2"]) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(100);
    }
    await page.waitForURL("**/dashboard/board**", { timeout: 10000 });
    await page.goto(CONFIG.numbersUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
  }

  console.log("3. Setting date range to '30 days'...");
  await page.getByRole("button", { name: "30 days" }).click();
  await sleep(2000); // Settle data and chart rendering

  // Reset to absolute top
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await sleep(500);

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const innerHeight = await page.evaluate(() => window.innerHeight);
  const maxScrollY = scrollHeight - innerHeight;

  console.log(`Scrollable height: ${maxScrollY}px (total ${scrollHeight}px).`);

  const tStartS = (Date.now() - videoStartTime) / 1000;
  console.log(`Scroll start timestamp: ${tStartS.toFixed(3)}s`);

  // Pure linear scroll over 5 seconds
  const durationMs = CONFIG.targetDurationS * 1000;
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

  const tEndS = (Date.now() - videoStartTime) / 1000;
  console.log(`Scroll end timestamp: ${tEndS.toFixed(3)}s`);

  await sleep(500);

  console.log("Finalizing raw video...");
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  console.log("Raw video captured at:", rawPath);

  const finalMp4 = path.join(CONFIG.outDir, "kroma-numbers-demo.mp4");

  console.log(`=== Re-encoding ${CONFIG.targetDurationS}s Linear MP4 ===`);
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
