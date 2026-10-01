import { FacultyOfferingDirectory } from "@/components/faculty/FacultyOfferingDirectory";

export default function FacultyMarksPage() {
  return (
    <FacultyOfferingDirectory
      title="Marks"
      subtitle="Open a course to enter internal marks for your sections."
      focus="marks"
    />
  );
}
