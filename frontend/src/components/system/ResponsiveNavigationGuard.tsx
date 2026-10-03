"use client";

import { useEffect } from "react";

/**
 * Keeps the shared authenticated shell state sane when the viewport crosses
 * the desktop/drawer breakpoint. UnifiedDashboardFrame already owns the
 * drawer state; this component only asks that shell to close stale mobile
 * state when desktop navigation becomes active.
 */
export function ResponsiveNavigationGuard() {
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");

    const closeStaleMobileNavigation = () => {
      if (media.matches) {
        window.dispatchEvent(
          new Event("acadlyx:navigation-close"),
        );
      }
    };

    closeStaleMobileNavigation();
    media.addEventListener(
      "change",
      closeStaleMobileNavigation,
    );

    return () => {
      media.removeEventListener(
        "change",
        closeStaleMobileNavigation,
      );
    };
  }, []);

  return null;
}
