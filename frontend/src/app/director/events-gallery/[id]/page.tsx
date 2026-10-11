import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventDetailsContent } from "@/components/events/EventDetailsContent";
export default function DirectorEventDetailsPage() { return <DashboardShell title="Campus Event" subtitle="Assigned-campus event details and gallery" allowedRoles={["DIRECTOR"]}><EventDetailsContent workspaceBasePath="/director/events-gallery" /></DashboardShell>; }
