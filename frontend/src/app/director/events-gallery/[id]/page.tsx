import { DashboardShell } from "@/components/dashboard/DashboardShell";
import EventDetailsPage from "@/app/events-gallery/[id]/page";
export default function DirectorEventDetailsPage() { return <DashboardShell title="Campus Event" subtitle="Assigned-campus event details and gallery" allowedRoles={["DIRECTOR"]}><EventDetailsPage workspaceBasePath="/director/events-gallery" /></DashboardShell>; }
