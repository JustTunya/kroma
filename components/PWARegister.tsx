"use client";

import { useEffect } from "react";

export function PWARegister({ scope = "/" }: { scope?: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope }).catch(() => {});
  }, [scope]);

  return null;
}
