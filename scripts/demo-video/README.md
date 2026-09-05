# KROMA demo video

1. `pnpm add -D playwright && npx playwright install chromium`
2. `pnpm dev` (localhost:3000 must be serving with seeded menu data)
3. `node scripts/demo-video/record.mjs`
   Raw webm lands in `scripts/demo-video/out/` (Playwright names it by GUID).

Before recording, temporarily force the hero static (no entrance fade/scale,
no WebGL warm-up) so the clip opens already settled instead of waiting out an
animation:
- `components/storefront/HeroParallax.tsx`: add `const FORCE_STATIC_DEMO = true;`
  above the component, guard the WebGL effect with
  `if (reduced || FORCE_STATIC_DEMO) return;`, and make `still` and the
  `motion.div`'s `initial` prop honor it (`initial={FORCE_STATIC_DEMO ? false : {...}}`).
- `components/storefront/StorefrontHero.tsx`: same constant, then
  `initial={FORCE_STATIC_DEMO || reduced ? false : "hidden"}` on the text block.
- Revert both with `git checkout -- components/storefront/HeroParallax.tsx components/storefront/StorefrontHero.tsx`
  right after recording — confirm `git diff --stat` on those two files is empty.

With the hero static, `CONFIG.heroSettleMs` only needs to cover paint/layout
(~250ms), not an animation. The script logs `SCROLL_START_S=<seconds>`, but
treat that as a starting guess, not gospel — it's a Node-side `Date.now()`
diff and doesn't always land exactly on the video's own frame timeline.
Verify before trusting it: extract candidate frames with
`ffmpeg -y -i "$IN" -ss <t> -frames:v 1 out.png` (put `-ss` *after* `-i` for
frame-accurate seeking) at a few points around the logged value and eyeball
them for the exact moment the page ledger/marquee first peeks in at the
bottom — that's scroll start. Pick the last fully-static frame's timestamp
as `-ss` for the real encode below, then re-extract frame 0 of the encoded
output to confirm it's still the untouched top of the page before shipping it.

The script also hides the scrollbar (`page.addInitScript` CSS) and launches
Chromium with `--hide-scrollbars`. Both are needed: the CSS only hides
page-drawn scrollbars, but headed Chromium on Windows renders the OS-themed
native scrollbar (with up/down arrow buttons) which CSS can't touch — only
the launch flag disables scrollbar compositing entirely.

Behavior: one constant-speed linear scroll from top to the bottom of the page,
no stops or speed changes. The cursor is pinned at a fixed viewport point
(inside the menu list column); as rows scroll underneath it, each one hovers
naturally in turn (real pointer events, not a class toggle) — the "camera"
and the hover progression move at the same pace by construction. Tune
`scrollPxPerSecond` / `anchor` in `CONFIG` at the top of the script.

Known quirk: after "closing context, finalizing video" the Node process can
hang on Windows during Chromium teardown even though the video file is
already fully written and stable on disk — check the file size/mtime and
kill the process if it doesn't exit within a few seconds.

## Post-process (16:9, web-ready, muted, loop-friendly)

```bash
IN=scripts/demo-video/out/<recorded>.webm

# 1920x1080 raw -> 1280x720/24fps web-optimized (card/embed use, not full-bleed hero)
ffmpeg -i "$IN" -ss 0.3 \
  -vf "scale=1280:-2,fps=24" \
  -an -movflags +faststart \
  -c:v libx264 -preset veryslow -crf 30 -pix_fmt yuv420p \
  scripts/demo-video/out/kroma-demo.mp4

ffmpeg -i "$IN" -ss 0.3 \
  -vf "scale=1280:-2,fps=24" \
  -an -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 \
  scripts/demo-video/out/kroma-demo.webm
```

At ~24s / 1280x720 this lands around 1-1.5MB per format. Adjust `-ss` after reviewing
the raw clip for dead frames at the very start. Raise `scale` back to 1920 (drop the
`fps=24`) for a full-bleed hero placement where the extra weight is worth it; drop
`-crf` a few points if banding shows on the terracotta/canvas gradients.
