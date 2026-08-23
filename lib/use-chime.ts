"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * One soft ping when an order arrives.
 *
 * Synthesised rather than shipped as a file: two sine tones through a gain
 * ramp is a handful of lines, no asset to load, and nothing to go missing when
 * the wifi is the thing that just broke. A fifth (A5 → E6) reads as an
 * announcement rather than an alarm, which is the register the room needs.
 *
 * iPadOS keeps an AudioContext suspended until a user gesture, so `arm()` is
 * called from the shift-start overlay's tap. Everything here fails quietly: a
 * board that throws because audio is unavailable is worse than a silent board.
 */
export function useChime() {
  const context = useRef<AudioContext | null>(null);

  const arm = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      void context.current.resume();
    } catch {
      // No Web Audio, or the browser refused. The board still works.
    }
  }, []);

  const play = useCallback(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running") return;

    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      // Quick attack, long tail. A square-edged envelope clicks.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      for (const [frequency, at] of [
        [880, 0],
        [1318.5, 0.08],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start(now + at);
        osc.stop(now + 1);
      }
    } catch {
      // Same rule: never let the chime take the board down.
    }
  }, []);

  useEffect(() => () => void context.current?.close(), []);

  return { arm, play };
}
