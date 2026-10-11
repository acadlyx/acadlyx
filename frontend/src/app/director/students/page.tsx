import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="DIRECTOR"
      title="Director Students"
      subtitle="Assigned-campus student oversight within authorized scope"
      detailBasePath="/director/students"
    />
  );
}
