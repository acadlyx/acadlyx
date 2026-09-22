"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Offline acceleration is optional. The application remains fully
          // functional when service workers are unavailable or blocked.
        });
    };

    // Use a normal browser timer here instead of requestIdleCallback.
    // This avoids TypeScript/lib differences across Vercel build environments
    // while still keeping service-worker registration off the critical path.
    const timerId = window.setTimeout(register, 500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return null;
}
