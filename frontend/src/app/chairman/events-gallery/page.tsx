import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventsGalleryContent } from "@/components/events/EventsGalleryContent";

export default function ChairmanEventsGalleryPage() {
  return <DashboardShell title="Chairman Events & Gallery" subtitle="Create and publish events, posts and photos for your authorized scope" allowedRoles={["CHAIRMAN"]}>
    <EventsGalleryContent />
  </DashboardShell>;
}
