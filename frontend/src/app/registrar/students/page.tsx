import { RoleScopedStudents } from "@/components/dashboard/RoleScopedStudents";

export default function Page() {
  return (
    <RoleScopedStudents
      role="REGISTRAR"
      title="Registrar Students"
      subtitle="Registrar student records within authorised scope"
    />
  );
}
