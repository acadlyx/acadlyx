import { FacultyOfferingDirectory } from "@/components/faculty/FacultyOfferingDirectory";

export default function FacultyAttendancePage() {
  return (
    <FacultyOfferingDirectory
      title="Attendance"
      subtitle="Open a course to mark or correct attendance for your sections."
      focus="attendance"
    />
  );
}
