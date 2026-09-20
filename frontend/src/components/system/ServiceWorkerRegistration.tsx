"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Offline acceleration is optional. The application remains fully
        // functional when service workers are unavailable or blocked.
      });
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(register, 500);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
