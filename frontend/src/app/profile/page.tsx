import { DashboardShell } from "@/components/dashboard/DashboardShell";
import MyProfilePage from "@/components/dashboard/MyProfilePage";

export default function ProfilePage() {
  return <DashboardShell title="My Profile" subtitle="Manage your contact details and photo, and review your institutional access record"><MyProfilePage /></DashboardShell>;
}
