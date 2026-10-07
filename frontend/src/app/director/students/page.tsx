import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="DIRECTOR"
      title="Director Students"
      subtitle="Institution/campus student oversight within authorised scope"
    />
  );
}
