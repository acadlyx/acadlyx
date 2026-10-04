"use client";

import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function ChairmanReportsPage() {
  return (
    <RoleScopedReports
      role="CHAIRMAN"
      title="Chairman Reports"
      subtitle="Institution-wide reporting and oversight"
    />
  );
}
