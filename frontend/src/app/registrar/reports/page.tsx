"use client";

import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function RegistrarReportsPage() {
  return (
    <RoleScopedReports
      role="REGISTRAR"
      title="Registrar Reports"
      subtitle="Academic records, registration and institutional reporting"
    />
  );
}
