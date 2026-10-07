import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function Page() {
  return (
    <RoleScopedReports
      role="LIBRARIAN"
      title="Library Reports"
      subtitle="Library reporting within authorised scope"
    />
  );
}
