import { DashboardShell } from "@/components/dashboard/DashboardShell";
import MyProfilePage from "@/components/dashboard/MyProfilePage";

export default function ProfilePage() {
  return <DashboardShell title="My Profile" subtitle="Read-only institutional identity and access record"><MyProfilePage /></DashboardShell>;
}
