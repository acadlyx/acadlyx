import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventDetailsContent } from "@/components/events/EventDetailsContent";
export default function ChairmanEventDetailsPage() { return <DashboardShell title="Institutional Event" subtitle="Institution-wide event details and gallery" allowedRoles={["CHAIRMAN"]}><EventDetailsContent workspaceBasePath="/chairman/events-gallery" /></DashboardShell>; }
