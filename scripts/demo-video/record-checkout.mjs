import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const OUT = "scripts/demo-video/out";
const viewport = { width: 1920, height: 1080 };
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
  s.textContent = `html{scrollbar-width:none!important}html::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}`;
  document.documentElement.appendChild(s);
});
const page = await context.newPage();
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await sleep(800);
const tStart = now();

const add = page.getByRole("button", { name: /Add Peppermint Tisane/ }).first();
await add.scrollIntoViewIfNeeded();
await sleep(900);
await add.click();
await sleep(1000);
await page.getByRole("button", { name: /Open order/ }).click();
await sleep(1200);
await page.getByRole("link", { name: /^Checkout/ }).click();
await page.waitForURL("**/checkout");
await sleep(1000);
await page.getByLabel(/name/i).first().fill("Alex");
const email = page.locator('input[type="email"]');
if (await email.count()) await email.fill("alex@example.com");
await page.getByRole("button", { name: "Pay now" }).first().click();
await sleep(900);
await page.getByRole("button", { name: "Pay now" }).last().click();
console.log("submitted");
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
await page.waitForLoadState("load");
await sleep(3500);
console.log("on stripe", page.url());
const tEnd = now();

const video = page.video();
console.log("closing");
await Promise.race([page.close(), sleep(20000)]);console.log("page closed");
await Promise.race([context.close(), sleep(20000)]);console.log("ctx closed");
await Promise.race([browser.close(), sleep(20000)]);
const raw = await video.path();
const out = path.join(OUT, "kroma-checkout-demo.mp4");
execSync(
  `ffmpeg -y -i "${raw}" -vf "trim=start=${tStart.toFixed(2)}:end=${tEnd.toFixed(2)},setpts=PTS-STARTPTS,scale=1280:720,fps=30" -an -movflags +faststart -c:v libx264 -preset veryslow -crf 22 -pix_fmt yuv420p "${out}"`,
  { stdio: "inherit" },
);
await unlink(raw).catch(() => {});
console.log("DONE", out, tEnd - tStart);
