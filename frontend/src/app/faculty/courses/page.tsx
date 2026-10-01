import { FacultyOfferingDirectory } from "@/components/faculty/FacultyOfferingDirectory";

export default function FacultyCoursesPage() {
  return (
    <FacultyOfferingDirectory
      title="My courses"
      subtitle="The course offerings assigned to you this term."
      focus="attendance"
    />
  );
}
