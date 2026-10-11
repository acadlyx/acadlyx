import { DashboardShell } from "@/components/dashboard/DashboardShell";
import EventDetailsPage from "@/app/events-gallery/[id]/page";
export default function ChairmanEventDetailsPage() { return <DashboardShell title="Institutional Event" subtitle="Institution-wide event details and gallery" allowedRoles={["CHAIRMAN"]}><EventDetailsPage workspaceBasePath="/chairman/events-gallery" /></DashboardShell>; }
