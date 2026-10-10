"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

const OUTSIDE_DASHBOARD = [
  /^\/$/,
  /^\/about(?:\/|$)/,
  /^\/partners(?:\/|$)/,
  /^\/team(?:\/|$)/,
  /^\/updates(?:\/|$)/,
  /^\/contact(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
  /^\/mfa(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
  /^\/setup(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

function pageTitle(pathname: string) {
  const leaf = pathname.split("/").filter(Boolean).at(-1) || "Workspace";
  return decodeURIComponent(leaf)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function PersistentDashboardRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (OUTSIDE_DASHBOARD.some((pattern) => pattern.test(pathname))) return <>{children}</>;

  return (
    <DashboardShell
      forceShell
      title={pageTitle(pathname)}
      subtitle="ACADLYX • Institutional workspace"
    >
      {children}
    </DashboardShell>
  );
}
