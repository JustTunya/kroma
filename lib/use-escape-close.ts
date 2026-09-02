"use client";

import { useEffect } from "react";

/** Every sheet/dialog in the app is hand-rolled (no Radix/Base UI overlay
 * primitive backs them), so Escape-to-dismiss — required by the WAI-ARIA
 * dialog pattern — has to be wired in per component. `active` gates it so a
 * closed sheet's listener doesn't fire, and so nested sheets (menu item sheet
 * over the board, say) don't all react to one keypress. */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, onClose]);
}
