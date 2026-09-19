import { DashboardShell } from "@/components/dashboard/DashboardShell";
import Phase1ModulePage from "@/components/phase1/Phase1ModulePage";

export default function Page() {
  return (
    <DashboardShell
      title="Student Applications"
      subtitle="ACADLYX Core ERP"
    >
      <Phase1ModulePage module="applications" />
    </DashboardShell>
  );
}
