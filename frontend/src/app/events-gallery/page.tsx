import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventsGalleryContent } from "@/components/events/EventsGalleryContent";

export default function EventsGalleryPage() {
  return <DashboardShell title="Events & Gallery" subtitle="Create, publish and manage institutional events, posts and photos" allowedRoles={["INSTITUTION_ADMIN","DIRECTOR","REGISTRAR","CMS"]}>
    <EventsGalleryContent />
  </DashboardShell>;
}
