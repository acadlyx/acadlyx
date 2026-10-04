"use client";

import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function DeanReportsPage() {
  return (
    <RoleScopedReports
      role="DEAN"
      title="Dean Reports"
      subtitle="Faculty, academic and departmental reporting"
    />
  );
}
