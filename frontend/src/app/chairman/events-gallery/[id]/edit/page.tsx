"use client";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EventEditor } from "@/components/events/EventEditor";
export default function ChairmanEditEventPage() { const params = useParams<{ id: string }>(); return <DashboardShell title="Edit Institutional Event" subtitle="Manage event content within your institution scope" allowedRoles={["CHAIRMAN"]}><EventEditor eventId={params.id} workspaceBasePath="/chairman/events-gallery" /></DashboardShell>; }
