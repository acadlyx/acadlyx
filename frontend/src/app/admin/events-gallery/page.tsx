import { EventsGalleryContent } from "@/components/events/EventsGalleryContent";
import DataExportActions from "@/components/dashboard/DataExportActions";

export default function AdminEventsGalleryPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <DataExportActions type="institutional-events" compact />
        <DataExportActions type="event-media" compact />
      </div>
      <EventsGalleryContent embedded />
    </div>
  );
}
