import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventsGalleryContent } from "@/components/events/EventsGalleryContent";

export default function EventsGalleryPage() {
  return <DashboardShell title="Events & Gallery" subtitle="Create, publish and manage institutional events, posts and photos" allowedRoles={["CHAIRMAN","MANAGEMENT","DIRECTOR","DEAN","REGISTRAR","HOD","FACULTY","ACCOUNTS","HR","ADMISSIONS","EXAMINATION","LIBRARIAN","PLACEMENT","IT","CMS","STUDENT","PARENT","CLUB_PRESIDENT","STAFF"]}>
    <EventsGalleryContent />
  </DashboardShell>;
}
