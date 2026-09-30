"use client";

import { RoleWorkspaceLanding } from "@/components/dashboard/RoleWorkspaceLanding";
import type { CanonicalRole } from "@/lib/authorization";

interface SpecialistDashboardProps {
  role: CanonicalRole;
}

export function SpecialistDashboard({
  role,
}: SpecialistDashboardProps) {
  return <RoleWorkspaceLanding role={role} />;
}
