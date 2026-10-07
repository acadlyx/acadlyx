"use client";

import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function HodReportsPage() {
  return (
    <RoleScopedReports
      role="HOD"
      title="HOD Reports"
      subtitle="Department-scoped academic and operational reporting"
    />
  );
}
