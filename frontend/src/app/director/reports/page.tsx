"use client";

import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function DirectorReportsPage() {
  return (
    <RoleScopedReports
      role="DIRECTOR"
      title="Director Reports"
      subtitle="Executive institutional reporting and operational oversight"
    />
  );
}
