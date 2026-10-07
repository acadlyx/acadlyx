import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="CHAIRMAN"
      title="Chairman Students"
      subtitle="Institution-level student oversight within authorised scope"
    />
  );
}
