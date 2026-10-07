import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="PLACEMENT"
      title="Placement Students"
      subtitle="Placement student population within authorised scope"
    />
  );
}
