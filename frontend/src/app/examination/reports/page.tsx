import { RoleScopedReports } from "@/components/reports/RoleScopedReports";

export default function Page() {
  return (
    <RoleScopedReports
      role="EXAMINATION"
      title="Examination Reports"
      subtitle="Examination reporting within authorised scope"
    />
  );
}
