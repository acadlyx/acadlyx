import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventEditor } from "@/components/events/EventEditor";
export default function DirectorNewEventPage() { return <DashboardShell title="Create Campus Event" subtitle="Publish an event within your assigned campus scope" allowedRoles={["DIRECTOR"]}><EventEditor workspaceBasePath="/director/events-gallery" requireDepartment /></DashboardShell>; }
