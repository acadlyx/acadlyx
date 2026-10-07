"use client";

import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export function PlacementTeamShell({ children }: { children: ReactNode }) {
  return <DashboardShell title="Placement Command Center" subtitle="Operational placement control across employers, drives, applications, interviews, offers and joining verification." allowedRoles={["PLACEMENT"]}>{children}</DashboardShell>;
}
