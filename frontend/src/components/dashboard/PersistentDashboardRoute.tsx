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
  // Preserve explicit workflow naming when a route's page-level DashboardShell
  // is embedded under this persistent shell (e.g. "Placement Calendar").
  const normalizedPath = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const explicitTitles: Record<string, string> = {
    "/placements/calendar": "Placement Calendar",
    "/placements/applications": "Placement Applications",
    "/placements/offers": "Placement Offers",
    "/placements/drives": "Placement Drives",
    "/placements/openings": "Job Openings",
    "/placements/reports": "Placement Intelligence",
  };
  if (explicitTitles[normalizedPath]) return explicitTitles[normalizedPath];

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
