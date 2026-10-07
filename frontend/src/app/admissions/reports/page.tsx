import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function Page() {
  return (
    <RoleScopedReports
      role="ADMISSIONS"
      title="Admissions Reports"
      subtitle="Admissions reporting within authorised scope"
    />
  );
}
