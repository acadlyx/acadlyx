import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventEditor } from "@/components/events/EventEditor";
export default function ChairmanNewEventPage() { return <DashboardShell title="Create Institutional Event" subtitle="Publish an event within your institution workspace" allowedRoles={["CHAIRMAN"]}><EventEditor workspaceBasePath="/chairman/events-gallery" /></DashboardShell>; }
