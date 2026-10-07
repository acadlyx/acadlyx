import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function Page() {
  return (
    <RoleScopedReports
      role="PLACEMENT"
      title="Placement Reports"
      subtitle="Placement reporting within authorised scope"
    />
  );
}
