import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="ADMISSIONS"
      title="Admissions Students"
      subtitle="Admissions student records within authorised scope"
    />
  );
}
