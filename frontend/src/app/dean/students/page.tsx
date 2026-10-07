import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="DEAN"
      title="Dean Students"
      subtitle="Academic student oversight within authorised scope"
    />
  );
}
