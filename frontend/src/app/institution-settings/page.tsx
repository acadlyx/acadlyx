import { DashboardShell } from "@/components/dashboard/DashboardShell";
import Phase2ModulePage from "@/components/phase2/Phase2ModulePage";

export default function Page() {
  return (
    <DashboardShell title="Institution Settings" subtitle="ACADLYX Core ERP">
      <Phase2ModulePage module="settings" />
    </DashboardShell>
  );
}
