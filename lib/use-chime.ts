"use client";

import { useCallback, useEffect, useRef } from "react";

export function useChime() {
  const context = useRef<AudioContext | null>(null);

  const arm = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      void context.current.resume();
    } catch {

    }
  }, []);

  const play = useCallback(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running") return;

    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

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

    }
  }, []);

  useEffect(() => () => void context.current?.close(), []);

  return { arm, play };
}
