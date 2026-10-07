import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function ManagementReportsPage() {
  return (
    <RoleScopedReports
      role="MANAGEMENT"
      title="Management Reports"
      subtitle="Institutional performance and decision-support reporting"
    />
  );
}
