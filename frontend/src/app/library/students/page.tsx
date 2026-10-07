import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="LIBRARIAN"
      title="Library Students"
      subtitle="Student access records within authorised scope"
    />
  );
}
