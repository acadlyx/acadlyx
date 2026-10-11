import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="CHAIRMAN"
      title="Chairman Students"
      subtitle="Institution-wide student oversight within authorized scope"
      detailBasePath="/chairman/students"
    />
  );
}
