"use client";

import { RoleWorkspaceLanding } from "@/components/dashboard/RoleWorkspaceLanding";
import type { CanonicalRole } from "@/lib/authorization";

export function SpecialistDashboard({ role }: { role: CanonicalRole }) {
  return <RoleWorkspaceLanding role={role} />;
}
