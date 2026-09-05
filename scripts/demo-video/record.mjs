// Records a single, constant-speed scroll of the KROMA storefront from top to
// the bottom of the page. The cursor stays pinned at a fixed point in the
// viewport — as the page scrolls beneath it, whatever menu row is currently
// under that point hovers naturally (real pointer events, not a class toggle).
// No per-row stops: scroll speed never changes until the page ends.
//
// Run: node scripts/demo-video/record.mjs
// Requires: pnpm add -D playwright && npx playwright install chromium

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const CONFIG = {
  url: "http://localhost:3000",
  viewport: { width: 1920, height: 1080 },
  outDir: "scripts/demo-video/out",
  // px/second of document scroll — slow and cinematic. Total duration is
  // derived from page height so pace stays constant regardless of content.
  scrollPxPerSecond: 235,
  minDurationMs: 10000,
  maxDurationMs: 25000,
  // Where the cursor sits in the viewport (fraction of width/height). Chosen
  // to stay inside the menu list column, left of the 360px sticky preview
  // panel that occupies the right edge on desktop widths.
  anchor: { xFrac: 0.3, yFrac: 0.45 },
  // ms between forced pointermove ticks that make the browser re-evaluate
  // :hover as content scrolls under the stationary cursor (scrolling alone
  // does not fire pointermove, so hover would otherwise never update).
  hoverRefreshMs: 90,
  entranceMoveSteps: 25,
  // Hero entrance/WebGL is temporarily disabled (FORCE_STATIC_DEMO in
  // HeroParallax.tsx / StorefrontHero.tsx) for recording, so this only
  // needs to cover paint settling, not an animation.
  heroSettleMs: 250,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Linear (constant-speed) scroll from the current position to targetY.
async function linearScrollTo(page, targetY, durationMs) {
  await page.evaluate(
    ([targetY, durationMs]) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        const delta = targetY - startY;
        const start = performance.now();
        function step(now) {
          const t = Math.min((now - start) / durationMs, 1);
          window.scrollTo(0, startY + delta * t);
          if (t < 1) requestAnimationFrame(step);
          else resolve(undefined);
        }
        requestAnimationFrame(step);
      }),
    [targetY, durationMs],
  );
}

async function smoothMouseMove(page, fromX, fromY, toX, toY, steps) {
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  for (let i = 1; i <= steps; i++) {
    const t = easeInOutSine(i / steps);
    await page.mouse.move(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
    await sleep(12);
  }
}

// Alternates a 1px jitter at the anchor point so the browser dispatches real
// pointermove events (Playwright dedupes moves to an unchanged position),
// forcing :hover to re-evaluate as rows scroll underneath.
function startHoverRefresh(page, x, y, intervalMs) {
  let flip = false;
  const timer = setInterval(() => {
    flip = !flip;
    page.mouse.move(x, y + (flip ? 1 : 0)).catch(() => {});
  }, intervalMs);
  return () => clearInterval(timer);
}

async function main() {
  await mkdir(CONFIG.outDir, { recursive: true });

  // Headed mode uses the real compositor pipeline — headless Chromium's
  // software compositor tends to drop/uneven frames on a long scroll.
  // --hide-scrollbars disables scrollbar compositing entirely — the CSS
  // ::-webkit-scrollbar rule below only hides page-drawn scrollbars, not
  // the OS-themed native one headed Chromium renders on Windows.
  const browser = await chromium.launch({ headless: false, args: ["--hide-scrollbars"] });
  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: { dir: CONFIG.outDir, size: CONFIG.viewport },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      html { scrollbar-width: none; }
      html::-webkit-scrollbar { display: none; width: 0; height: 0; }
    `;
    document.documentElement.appendChild(style);
  });

  const recordStart = Date.now();
  await page.goto(CONFIG.url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Hero entrance (opacity 1.1s, scale 2.4s, staggered text to 0.5s+) must
  // fully settle before we start scrolling — otherwise the trimmed clip
  // would still show it fading/scaling mid-scroll.
  await sleep(CONFIG.heroSettleMs);

  const anchorX = CONFIG.viewport.width * CONFIG.anchor.xFrac;
  const anchorY = CONFIG.viewport.height * CONFIG.anchor.yFrac;

  console.log("moving cursor to anchor point");
  await smoothMouseMove(
    page,
    CONFIG.viewport.width / 2,
    CONFIG.viewport.height / 2,
    anchorX,
    anchorY,
    CONFIG.entranceMoveSteps,
  );

  const maxScrollY = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  const durationMs = Math.min(
    CONFIG.maxDurationMs,
    Math.max(CONFIG.minDurationMs, (maxScrollY / CONFIG.scrollPxPerSecond) * 1000),
  );
  console.log(
    `scrolling 0 -> ${maxScrollY}px over ${(durationMs / 1000).toFixed(1)}s, constant speed`,
  );

  const scrollStartS = (Date.now() - recordStart) / 1000;
  console.log(`SCROLL_START_S=${scrollStartS.toFixed(2)}`);

  const stopHoverRefresh = startHoverRefresh(page, anchorX, anchorY, CONFIG.hoverRefreshMs);
  await linearScrollTo(page, maxScrollY, durationMs);
  stopHoverRefresh();

  console.log("reached bottom of page, holding");
  await sleep(1500);

  console.log("closing context, finalizing video");
  await context.close();
  await browser.close();
  console.log(`Raw video written to ${CONFIG.outDir}/`);
  process.exit(0); // chromium teardown can hang on Windows otherwise
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
