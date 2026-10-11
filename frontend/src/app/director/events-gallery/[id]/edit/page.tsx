"use client";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventEditor } from "@/components/events/EventEditor";
export default function DirectorEditEventPage() { const params = useParams<{ id: string }>(); return <DashboardShell title="Edit Campus Event" subtitle="Manage event content within your assigned campus scope" allowedRoles={["DIRECTOR"]}><EventEditor eventId={params.id} workspaceBasePath="/director/events-gallery" requireDepartment /></DashboardShell>; }
