import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const OUT = "scripts/demo-video/out";
const MENU = "http://localhost:3000/dashboard/menu";
const viewport = { width: 1920, height: 1080 };
const SCROLL_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const f of await readdir(OUT).catch(() => []))
  if (f.endsWith(".webm")) await unlink(path.join(OUT, f)).catch(() => {});

const browser = await chromium.launch({
  headless: false,
  args: ["--hide-scrollbars", "--disable-features=OverlayScrollbar"],
});
const context = await browser.newContext({ viewport, recordVideo: { dir: OUT, size: viewport } });
await context.addInitScript(() => {
  const s = document.createElement("style");
  s.textContent = `*{scroll-behavior:auto!important}html,*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}`;
  document.documentElement.appendChild(s);
});
const page = await context.newPage();
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;

const unlock = async () => {
  if (!page.url().includes("/unlock")) return;
  await page.locator("ul li button").first().click();
  for (const d of "4242") {
    await page.keyboard.press(d);
    await page.waitForTimeout(100);
  }
  await page.waitForURL("**/dashboard/board**", { timeout: 10000 });
};

await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Try the staff side/i }).click();
await page.waitForURL("**/dashboard**", { timeout: 15000 });
await unlock();
await page.goto(MENU, { waitUntil: "networkidle" });
if (page.url().includes("/unlock")) {
  await unlock();
  await page.goto(MENU, { waitUntil: "networkidle" });
}
await page.evaluate(() => document.fonts.ready);
await sleep(500);

const tStart = now();
await sleep(1000);
await page.locator("main ul li button").first().click();
const dialog = page.getByRole("dialog", { name: "Edit item" });
await dialog.waitFor();
await sleep(1200); // spring settles

const max = await dialog.evaluate((el) => el.scrollHeight - el.clientHeight);
console.log("scrollable", max);
await dialog.evaluate(
  (el, [max, ms]) =>
    new Promise((res) => {
      let t = null;
      const step = (n) => {
        t ??= n;
        const p = Math.min((n - t) / ms, 1);
        el.scrollTop = max * p;
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    }),
  [max, SCROLL_MS],
);
await sleep(700);
const tEnd = now();

const video = page.video();
await Promise.race([page.close(), sleep(20000)]);
await Promise.race([context.close(), sleep(20000)]);
await Promise.race([browser.close(), sleep(20000)]);
const raw = await video.path();
const out = path.join(OUT, "kroma-menu-demo.mp4");
execSync(
  `ffmpeg -y -i "${raw}" -vf "trim=start=${tStart.toFixed(2)}:end=${tEnd.toFixed(2)},setpts=PTS-STARTPTS,scale=1280:720,fps=30" -an -movflags +faststart -c:v libx264 -preset veryslow -crf 22 -pix_fmt yuv420p "${out}"`,
  { stdio: "inherit" },
);
await unlink(raw).catch(() => {});
console.log("DONE", out, (tEnd - tStart).toFixed(1));
process.exit(0);
