import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventsGalleryContent } from "@/components/events/EventsGalleryContent";

export default function DirectorEventsGalleryPage() {
  return <DashboardShell title="Director Events & Gallery" subtitle="Create and publish events, posts and photos for your authorized scope" allowedRoles={["DIRECTOR"]}>
    <EventsGalleryContent />
  </DashboardShell>;
}
