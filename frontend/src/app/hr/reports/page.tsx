import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function Page() {
  return (
    <RoleScopedReports
      role="HR"
      title="HR Reports"
      subtitle="HR and workforce reporting within authorised scope"
    />
  );
}
